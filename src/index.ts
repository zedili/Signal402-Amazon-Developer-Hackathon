import { createApp } from "./app.js";

const { app } = createApp();
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

app.listen(port, host, () => {
  console.log(`Signal402 ready at http://${host}:${port}`);
  console.log(`MCP endpoint: http://${host}:${port}/mcp`);
});
