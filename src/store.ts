import { randomUUID } from "node:crypto";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand
} from "@aws-sdk/lib-dynamodb";

import { sha256 } from "./security.js";
import type { AuditEvent, PaymentIntent } from "./types.js";

export interface PaymentStore {
  getIntent(id: string): Promise<PaymentIntent | undefined>;
  getIntentByIdempotencyKey(key: string): Promise<PaymentIntent | undefined>;
  listIntents(): Promise<PaymentIntent[]>;
  saveIntent(intent: PaymentIntent): Promise<void>;
  appendAudit(event: Omit<AuditEvent, "id" | "hash" | "previousHash">): Promise<AuditEvent>;
  listAudit(intentId?: string): Promise<AuditEvent[]>;
  clear(): Promise<void>;
}

export class InMemoryPaymentStore implements PaymentStore {
  private readonly intents = new Map<string, PaymentIntent>();
  private readonly idempotency = new Map<string, string>();
  private readonly audit: AuditEvent[] = [];

  async getIntent(id: string): Promise<PaymentIntent | undefined> {
    return structuredClone(this.intents.get(id));
  }

  async getIntentByIdempotencyKey(key: string): Promise<PaymentIntent | undefined> {
    const id = this.idempotency.get(key);
    return id ? this.getIntent(id) : undefined;
  }

  async listIntents(): Promise<PaymentIntent[]> {
    return [...this.intents.values()]
      .map((intent) => structuredClone(intent))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async saveIntent(intent: PaymentIntent): Promise<void> {
    this.intents.set(intent.id, structuredClone(intent));
    this.idempotency.set(intent.idempotencyKey, intent.id);
  }

  async appendAudit(event: Omit<AuditEvent, "id" | "hash" | "previousHash">): Promise<AuditEvent> {
    const previousHash = this.audit.at(-1)?.hash ?? "GENESIS";
    const id = randomUUID();
    const hash = sha256(JSON.stringify({ ...event, id, previousHash }));
    const stored = { ...event, id, previousHash, hash };
    this.audit.push(stored);
    return structuredClone(stored);
  }

  async listAudit(intentId?: string): Promise<AuditEvent[]> {
    return this.audit
      .filter((event) => !intentId || event.intentId === intentId)
      .map((event) => structuredClone(event));
  }

  async clear(): Promise<void> {
    this.intents.clear();
    this.idempotency.clear();
    this.audit.length = 0;
  }
}

interface DynamoItem {
  PK: string;
  SK: string;
  GSI1PK?: string;
  GSI1SK?: string;
  GSI2PK?: string;
  GSI2SK?: string;
  payload: PaymentIntent | AuditEvent;
}

export class DynamoPaymentStore implements PaymentStore {
  private readonly client: DynamoDBDocumentClient;

  constructor(private readonly tableName: string, client?: DynamoDBDocumentClient) {
    this.client = client ?? DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true }
    });
  }

  async getIntent(id: string): Promise<PaymentIntent | undefined> {
    const result = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: { PK: `INTENT#${id}`, SK: "INTENT" }
    }));
    return result.Item ? structuredClone((result.Item as DynamoItem).payload as PaymentIntent) : undefined;
  }

  async getIntentByIdempotencyKey(key: string): Promise<PaymentIntent | undefined> {
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: "IdempotencyIndex",
      KeyConditionExpression: "GSI2PK = :pk",
      ExpressionAttributeValues: { ":pk": `IDEMP#${key}` },
      Limit: 1
    }));
    return result.Items?.[0] ? structuredClone((result.Items[0] as DynamoItem).payload as PaymentIntent) : undefined;
  }

  async listIntents(): Promise<PaymentIntent[]> {
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: "EntityIndex",
      KeyConditionExpression: "GSI1PK = :scope AND begins_with(GSI1SK, :type)",
      ExpressionAttributeValues: { ":scope": "SCOPE#default", ":type": "INTENT#" },
      ScanIndexForward: false
    }));
    return (result.Items ?? []).map((item) => structuredClone((item as DynamoItem).payload as PaymentIntent));
  }

  async saveIntent(intent: PaymentIntent): Promise<void> {
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        PK: `INTENT#${intent.id}`,
        SK: "INTENT",
        GSI1PK: "SCOPE#default",
        GSI1SK: `INTENT#${intent.createdAt}#${intent.id}`,
        GSI2PK: `IDEMP#${intent.idempotencyKey}`,
        GSI2SK: "INTENT",
        payload: intent
      },
      ConditionExpression: "attribute_not_exists(PK) OR #payload.#id = :id",
      ExpressionAttributeNames: { "#payload": "payload", "#id": "id" },
      ExpressionAttributeValues: { ":id": intent.id }
    }));
  }

  async appendAudit(event: Omit<AuditEvent, "id" | "hash" | "previousHash">): Promise<AuditEvent> {
    const previous = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :audit)",
      ExpressionAttributeValues: { ":pk": `INTENT#${event.intentId}`, ":audit": "AUDIT#" },
      ScanIndexForward: false,
      Limit: 1
    }));
    const previousHash = previous.Items?.[0]
      ? ((previous.Items[0] as DynamoItem).payload as AuditEvent).hash
      : "GENESIS";
    const id = randomUUID();
    const hash = sha256(JSON.stringify({ ...event, id, previousHash }));
    const stored: AuditEvent = { ...event, id, previousHash, hash };
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        PK: `INTENT#${event.intentId}`,
        SK: `AUDIT#${event.at}#${id}`,
        GSI1PK: "SCOPE#default",
        GSI1SK: `AUDIT#${event.at}#${id}`,
        payload: stored
      }
    }));
    return structuredClone(stored);
  }

  async listAudit(intentId?: string): Promise<AuditEvent[]> {
    const request = intentId
      ? {
          TableName: this.tableName,
          KeyConditionExpression: "PK = :pk AND begins_with(SK, :type)",
          ExpressionAttributeValues: { ":pk": `INTENT#${intentId}`, ":type": "AUDIT#" }
        }
      : {
          TableName: this.tableName,
          IndexName: "EntityIndex",
          KeyConditionExpression: "GSI1PK = :scope AND begins_with(GSI1SK, :type)",
          ExpressionAttributeValues: { ":scope": "SCOPE#default", ":type": "AUDIT#" }
        };
    const result = await this.client.send(new QueryCommand(request));
    return (result.Items ?? []).map((item) => structuredClone((item as DynamoItem).payload as AuditEvent));
  }

  async clear(): Promise<void> {
    let cursor: Record<string, unknown> | undefined;
    do {
      const result = await this.client.send(new ScanCommand({
        TableName: this.tableName,
        ProjectionExpression: "PK, SK",
        ExclusiveStartKey: cursor
      }));
      const items = result.Items ?? [];
      for (let index = 0; index < items.length; index += 25) {
        const chunk = items.slice(index, index + 25);
        await this.client.send(new BatchWriteCommand({
          RequestItems: {
            [this.tableName]: chunk.map((item) => ({ DeleteRequest: { Key: { PK: item.PK, SK: item.SK } } }))
          }
        }));
      }
      cursor = result.LastEvaluatedKey;
    } while (cursor);
  }
}

export function createDefaultStore(): PaymentStore {
  const tableName = process.env.DYNAMODB_TABLE;
  return tableName ? new DynamoPaymentStore(tableName) : new InMemoryPaymentStore();
}
