• Rely on the *official* `openai-node` SDK (v5+, ESM) and the public OpenAPI spec we just pulled
• Treat every field like an **attribute** in the attached “LLM Min Guideline” → give name, type, default, notes
• Show one canonical **request** and **response** snippet (non-stream & stream) in TypeScript
• Cover *all* current parameters: `model, messages, temperature, top_p… seed, response_format, tools…`
• Explain how multimodal `content` arrays and tool-call objects nest inside `messages`
• Map OpenAPI scalar types → TS types (`string → string`, `integer → number`, etc.)
• Point to JSON-mode (`response_format:{type:"json_object"}`) & how to parse
• Cite sources: OpenAPI YAML for schema, forum post for JSON mode, RunJS blog for key setup

---

### 1 · Quick start (TypeScript)

```ts
import OpenAI, {
  type ChatCompletionCreateParams,
  type ChatCompletion,
} from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const req: ChatCompletionCreateParams = {
  model: "gpt-4o-mini",              // any chat-capable model id
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user",   content: "Hello!" }
  ],
  temperature: 0.7,
  response_format: { type: "json_object" }, // JSON-mode
  seed: 42,
};

const res: ChatCompletion = await openai.chat.completions.create(req);
console.log(res.choices[0].message);
```

([GitHub][1])

> **Key points**
> • All request keys are camel-case; order is irrelevant.
> • Types are inferred from the SDK, so your editor will flag wrong fields automatically.

---

### 2 · Full request schema (latest 2025-06)

| Attribute            | Type                             | Required | Default    | Notes / Guideline Hook                              |
| -------------------- | -------------------------------- | -------- | ---------- | --------------------------------------------------- |
| `model`              | `string`                         | ✔︎       | –          | Must be chat-capable (`gpt-4.1`, `gpt-4o-mini`, …). |
| `messages`           | `ChatMessage[]`                  | ✔︎       | –          | See §3.                                             |
| `temperature`        | `number 0-2`                     | ✖︎       | `1`        | Stochastic sampling.                                |
| `top_p`              | `number 0-1`                     | ✖︎       | `1`        | Nucleus sampling.                                   |
| `max_tokens`         | `number`                         | ✖︎       | no cut-off | Hard cap on output.                                 |
| `n`                  | `number`                         | ✖︎       | `1`        | Parallel alternatives.                              |
| `stream`             | `boolean`                        | ✖︎       | `false`    | Server-sent events.                                 |
| `stop`               | `string\|string[]`               | ✖︎       | –          | Stop sequences.                                     |
| `presence_penalty`   | `number -2…2`                    | ✖︎       | `0`        | Encourage novelty.                                  |
| `frequency_penalty`  | `number -2…2`                    | ✖︎       | `0`        | Discourage repetition.                              |
| `logit_bias`         | `Record<tokenId,-100…100>`       | ✖︎       | –          | Token-level nudging.                                |
| `user`               | `string`                         | ✖︎       | –          | End-user identifier.                                |
| `tools`              | `ToolDef[]`                      | ✖︎       | –          | Functions / code-interpreters.                      |
| `tool_choice`        | `"none" \| "auto" \| {id}`       | ✖︎       | `"auto"`   | Force / forbid tool use.                            |
| `response_format`    | `{type:"text" \| "json_object"}` | ✖︎       | `"text"`   | JSON-mode output. ([OpenAI Community][2])           |
| `seed`               | `number`                         | ✖︎       | random     | Reproducibility.                                    |
| `system_fingerprint` | `string "auto" \| fingerprint`   | ✖︎       | `auto`     | Model snapshot.                                     |
| `store`              | `boolean`                        | ✖︎       | `false`    | Opt in to 120-day retention.                        |
| `metadata`           | `object`                         | ✖︎       | –          | Any opaque JSON.                                    |

*(Field names, defaulting behaviour, and types follow the DEF→ATTR pattern from the attached guideline.)* ([GitHub][1])

---

### 3 · Message object (`ChatMessage`)

```ts
type ChatMessage =
  | { role: "system" | "user" | "assistant", content: string | ChatPart[], name?: string }
  | { role: "tool", content: string, tool_call_id: string };
```

*`ChatPart[]`* enables **multimodal** requests:

```jsonc
{ "role":"user",
  "content":[
    { "type":"text", "text":"What's in this image?" },
    { "type":"image_url",
      "image_url":{ "url":"https://..." } }
  ] }
```

([GitHub][1])

---

### 4 · Tool definition (`ToolDef`)

```ts
interface ToolDef {
  type: "function";
  function: {
    name: string;                       // snake_case
    description: string;
    parameters: JSONSchema7;            // strict JSON Schema
  };
}
```

The assistant will reply with:

```json
{
  "role":"assistant",
  "tool_calls":[
    { "id":"call_abc", "type":"function",
      "function":{ "name":"getWeather", "arguments":"{\"city\":\"Berlin\"}" }
    }
  ]
}
```

---

### 5 · Response schema (non-stream)

```jsonc
{
  "id": "chatcmpl-abc",
  "object": "chat.completion",
  "created": 1741569952,
  "model": "gpt-4o-mini",
  "system_fingerprint": "fp_123",
  "choices": [
    {
      "index": 0,
      "message": { "role":"assistant", "content":"…", /* or tool_calls */ },
      "logprobs": null,
      "finish_reason": "stop"
    }
  ],
  "usage": { "prompt_tokens": 25, "completion_tokens": 12, "total_tokens": 37 }
}
```

([runjs.app][3])

> **Streaming** (`stream:true`) returns Server-Sent-Event *chunks* with a
> `ChatCompletionChunk` payload—identical keys, but `choices[].delta`
> contains only the token diff.

---

### 6 · Putting it all together

```ts
async function chat(messages: ChatCompletionCreateParams["messages"]) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    tools: [{
      type: "function",
      function: {
        name: "get_weather",
        description: "Get current weather in °C",
        parameters: {
          type: "object",
          properties: { city: { type: "string" } },
          required: ["city"]
        }
      }
    }],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });
  return completion.choices[0].message;
}
```

---

### 7 · Minimum checklist (verify before deploy)

1. **Auth**: `OPENAI_API_KEY` set (and *never* shipped client-side). ([OpenAI Community][2])
2. **Model ID** exists in your account’s “Models” page.
3. **Token budget**: `max_tokens + prompt_tokens` ≤ model limit.
4. **JSON mode** on if you need machine-parsable replies.&#x20;
5. **Tool schema** is strict JSON Schema v7; arguments parse with `JSON.parse`.
6. **Error handling**: catch `OpenAI.APIError` and log `error.code`, `error.status`, `error.message`.
7. **Rate limits**: exponential back-off on HTTP 429 / 502.
8. **Privacy**: set `store:false` unless you explicitly need retrieval later.

Follow these steps and you’ll have a **type-safe, fully featured** Chat Completions workflow that honours both OpenAI’s latest API contract and the structural clarity rules in the attached guideline.

[1]: https://raw.githubusercontent.com/openai/openai-openapi/refs/heads/master/openapi.yaml?utm_source=chatgpt.com "https://raw.githubusercontent.com/openai/openai-op..."
[2]: https://community.openai.com/t/how-do-i-use-the-new-json-mode/475890?utm_source=chatgpt.com "How do I use the new JSON mode? - API"
[3]: https://runjs.app/blog/chatgpt-javascript-api?utm_source=chatgpt.com "How to use the ChatGPT JavaScript API - 3 Easy Steps (2023) - RunJS"
