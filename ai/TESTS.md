# TESTS.md

## Test Creation & Running (Expo + Jest + TypeScript)

- **Test Location:**
  - Unit/Integration: `__tests__` folders near code (e.g. `utils/ai/__tests__/`)
  - E2E: `e2e/`

- **Test Framework:** [Jest](https://jestjs.io/) with [jest-expo](https://docs.expo.dev/develop/unit-testing/)

- **Key Config (in `package.json`):**
  ```json
  "jest": {
    "preset": "jest-expo",
    "transformIgnorePatterns": [
      "node_modules/(?!(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)"
    ]
  }
  ```

- **Write a test:**
  - Example: `utils/ai/__tests__/mcpClient.test.ts`
  - Use `import fetch from 'node-fetch'` and `import EventSource from 'eventsource'` for HTTP/SSE integration tests.

- **Suppress missing types:**
  - Add `// @ts-expect-error` above `import EventSource from 'eventsource';` if needed.

- **Run all tests:**
  ```sh
  pnpm test
  # or
  npx jest
  ```

- **Coverage:**
  ```sh
  pnpm test -- --coverage
  ```

- **Troubleshooting:**
  - If Jest fails on node_modules syntax, check `preset` and `transformIgnorePatterns`.
  - For Expo/React Native, always use `jest-expo` preset.

- **References:**
  - [Expo Unit Testing Guide](https://docs.expo.dev/develop/unit-testing/) 