# Project Overview

This document provides an overview of the Filipa AI React Native project structure and its features based on the initial directory listing.

## Directory Structure

*   **`.expo/`**: Contains Expo-specific configuration and cache files. Managed by Expo CLI.
*   **`.git/`**: Standard Git directory for version control.
*   **`.cursor/`**: Cursor IDE specific files. (Ignored as per instructions)
*   **`app/`**: Contains the main application screens and navigation logic.
    *   `index.tsx`: Application entry point, likely routing to the main chat screen.
    *   `settings.tsx`: Screen for managing application settings, including API keys and MCP configurations.
    *   `_layout.tsx`: Root layout component, typically setting up navigation.
*   **`assets/`**: Static assets like images, fonts, etc.
*   **`components/`**: Reusable UI components used across different parts of the application.
    *   Likely contains chat-specific components (`ChatMessage.tsx`, `ChatInput.tsx` etc.) and UI elements.
*   **`config/`**: Configuration files for the application, such_as i18n.
    *   `i18n.ts`: Internationalization setup.
*   **`constants/`**: Application-wide constants like color palettes, API provider models, default styles, and system prompts.
*   **`locales/`**: Translation files for internationalization (e.g., `en.json`).
*   **`node_modules/`**: Contains all the project dependencies installed via pnpm.
*   **`providers/`**: React Context providers for managing global concerns like theming.
*   **`store/`**: Zustand stores for managing application state.
*   **`services/`**: Might contain service-specific logic (needs verification).
*   **`utils/`**: Utility functions and classes.
    *   `ai/`: Contains AI-related logic, including `AiApiClient.ts` for API interactions and MCP related files (`mcpClient.ts`, `mcpManager.ts`, `mcpToOpenAiConverter.ts`, `mcpToolExecutor.ts`).
    *   `Database.ts`: Manages SQLite database interactions.
    *   `errorHandler.ts`: Handles application errors.
    *   `notificationDb.ts`: Manages database operations for notifications.
    *   `Interfaces.ts`: TypeScript interfaces.
*   **`__tests__/`**: Unit and integration tests.
*   **`e2e/`**: End-to-end tests (Detox).

## Key Files

*   **`app.json`**: Expo configuration file defining metadata, entry point, dependencies, and build settings.
*   **`babel.config.js`**: Babel configuration for JavaScript transpilation.
*   **`package.json`**: Defines project dependencies, scripts, and metadata.
*   **`pnpm-lock.yaml` / `package-lock.json`**: Lock files ensuring consistent dependency installation.
*   **`tsconfig.json`**: TypeScript configuration file.
*   **`README.md`**: Project description, setup instructions, etc.
*   **`overview.md`**: This file.
*   **`metro.config.js`**: Metro bundler configuration.
*   **`index.js`**: Main entry point for React Native.
*   **`.detoxrc.js`**: Detox E2E test configuration.
*   **`DUMMY.env`**: Example environment file.

## Zustand State Management

The application uses Zustand for managing global application state. Key stores include:

*   **`store/chatStore.ts` (`useChatStore`)**:
    *   Manages the state of the active chat session.
    *   Holds the `messages` array for the current chat.
    *   Tracks the `currentChatId` (UUID of the active chat).
    *   Manages `isStreaming` status for AI responses.
    *   Handles database initialization (`initializeDatabase`) and interactions for messages and chats (loading, adding, deleting).
    *   Manages sending messages (`sendMessage`) to the AI, including handling stream updates (`appendStreamChunk`, `updateLastMessageToolCalls`, `handleStreamEnd`, `handleStreamError`).
    *   Allows starting new chat sessions (`startNewChatSession`) and switching between chats (`setCurrentChatId`).
    *   Stores and sets the `selectedModelId`.
*   **`store/chatHistoryStore.ts` (`useChatHistoryStore`)**:
    *   Manages the list of chat history items (`chatHistories`) displayed, for example, in a navigation drawer.
    *   Loads chat sessions from the database (`loadChatHistories`).
    *   Handles adding, removing, and updating chat titles in the history view.
    *   Manages unseen message counts (`setUnseenCount`, `markChatAsReadAndViewed`).
    *   Tracks and sets the currently active chat in the history view (`setActiveChatInView`).
*   **`store/mcpStore.ts` (`useMcpStore`)**:
    *   Manages Model Context Protocol (MCP) server tools and their states.
    *   Stores `serverTools`: a map of server names to their available tools, including an `isActive` flag for each tool.
    *   Tracks `serverConnectionStatus`: a map of server names to their connection status (e.g., `CONNECTED`, `FAILED`).
    *   Provides actions to set/get server tools, toggle tool active status, and manage connection statuses.
*   **`store/notificationStore.ts` (`useNotificationStore`)**:
    *   Manages system notifications within the app.
    *   Holds an array of `notifications` and the `unseenCount`.
    *   Handles database initialization for notifications and CRUD operations (add, load, remove).
    *   Provides actions to mark notifications as seen or confirmed.
*   **`utils/ModelStore.ts` (Note: Not a Zustand store)**:
    *   This module is a collection of asynchronous functions for securely storing and retrieving data using `AsyncStorage` and `SecureStore`.
    *   Manages API keys for different AI providers (`setApiKey`, `getApiKey`).
    *   Stores user preferences like theme (`setThemePreference`, `getThemePreference`), user name, language, country.
    *   Persists the `lastSelectedModelId` and, crucially, the `lastActiveChatUUID` to allow resuming the previous session.
    *   Manages favorite models and model-specific settings like temperature.
    *   Handles storage of AI provider configurations and their models.

## Inferred Features (Based on Structure)

*   **React Native Application**: Built using React Native and managed with Expo.
*   **Component-Based Architecture**: Indicated by the `components/` directory, promoting reusable UI elements.
*   **Zustand State Management**: Utilized for managing global application state. Key stores include `useChatStore` for active chat interactions, `useChatHistoryStore` for managing the list of past chats, `useMcpStore` for MCP server tool management, and `useNotificationStore` for in-app notifications. (See "Zustand State Management" section for details).
*   **TypeScript Usage**: Confirmed by `tsconfig.json`, `expo-env.d.ts`, and the use of TypeScript in `.ts` and `.tsx` files throughout the project.
*   **Local Data Persistence**: Uses `expo-sqlite` for storing chat history, messages, and notification data, managed via `utils/Database.ts` and `utils/notificationDb.ts`.
*   **Secure Storage**: Leverages `expo-secure-store` via `utils/ModelStore.ts` for sensitive data like API keys.
*   **AsyncStorage**: Uses `@react-native-async-storage/async-storage` via `utils/ModelStore.ts` for user preferences and non-sensitive settings.
*   **Internationalization (i18n)**: Support for multiple languages using `i18n-js` and `expo-localization`, configured in `config/i18n.ts` with locales in `locales/`.

## Styling Conventions

*   **Central Colors**: All color definitions should reside in `constants/Colors.ts`. It likely defines color palettes for different themes (e.g., light and dark modes).
*   **Default Styles**: Reusable common styles (e.g., for containers, buttons, text inputs, standard text sizes) are expected to be defined in `constants/Styles.ts`. Components should import and utilize these `defaultStyles` to maintain visual consistency.
*   **Component-Specific Styles**: Styles that are unique to a single component should be defined within that component's `.tsx` file using `StyleSheet.create` from `react-native`.

## Internationalization (i18n)

*   **Library**: The project uses `i18n-js` integrated with `expo-localization` to handle translations.
*   **Configuration**: The primary setup is located in `config/i18n.ts`. This file initializes `i18n-js`, imports translation files, and sets the current locale based on device settings (`Localization.getLocales()`).
*   **Locales**: Translation files (e.g., `en.json`) are stored in the `locales/` directory. Each file contains key-value pairs for the strings in that language.
*   **Usage**: To use translations, import the `t` helper function from `config/i18n.ts` and wrap user-facing strings with it, for example: `t('someScope.someKey')`.
*   **Adding Translations**: To add new translations, define the corresponding key-value pair in all relevant locale files (e.g., `locales/en.json`, `locales/de.json`).

## Core Features (Post-Simplification Target)

The application aims to provide a direct chat interface with offline-first capabilities, robust API key management, and Model Context Protocol (MCP) integration.

**Essential Components/Screens:**

*   **`app/index.tsx`**: The main entry point of the application. It initializes `components/ChatPage.tsx` and handles initial setup like MCP connection initialization. It uses `expo-router` for potential route parameters (e.g., `chatId`).
*   **`app/_layout.tsx`**: The root layout component managed by `expo-router`. It likely sets up the main navigation structure, such as a Stack navigator, and includes global providers (e.g., ThemeProvider, SQLiteProvider, ToastProvider).
*   **`app/settings.tsx`**: Screen dedicated to managing application settings. This includes:
    *   Input and storage of API Keys for various AI providers (e.g., OpenAI, Groq).
    *   Management of Model Context Protocol (MCP) server connections (adding, removing, viewing status).
    *   User preferences like theme, language, etc.
*   **`components/ChatPage.tsx`**: The primary component rendering the chat interface. It is responsible for:
    *   Displaying the list of messages (`ChatMessage`) for the active chat session.
    *   Integrating `ChatInput.tsx` for user message input.
    *   Checking for API key existence and showing `ApiKeyMissingPlaceholder` if needed.
    *   Showing `EmptyChatPlaceholder` for new chats.
    *   Coordinating with `chatStore` to load messages, send messages, and handle streaming AI responses.
    *   Managing UI state related to chat input height and keyboard visibility.
*   **`components/ChatMessage.tsx`**: Renders individual chat messages, differentiating between user, AI, and potentially system/tool messages. Handles markdown rendering for AI responses, including images via `MarkdownImageRenderer.tsx`.
*   **`components/ChatInput.tsx`**: Provides the text input field for users to type messages, along with a send button. It might integrate with `ChatInputSheet.tsx` for additional input options.
*   **`components/ChatInputSheet.tsx`**: A bottom sheet component that can be triggered from `ChatInput.tsx`, potentially offering advanced input methods, tool selection, or other message-related actions.
*   **`components/ChatHeader.tsx`**: Displays at the top of the `ChatPage`, showing current chat information, model selection, and potentially actions like clearing chat or accessing chat settings.
*   **`components/drawer/CustomDrawerContent.tsx`**: Renders the content of the navigation drawer. It typically includes:
    *   A "New Chat" button to initiate a new conversation via `chatStore.startNewChatSession()`.
    *   A list of recent chat sessions, fetched and managed by `chatHistoryStore`.
    *   Navigation links to other parts of the app, like "Settings".
*   **`components/ApiKeyMissingPlaceholder.tsx`**: A placeholder shown on `ChatPage` if no API keys are configured, prompting the user to go to settings.
*   **`components/EmptyChatPlaceholder.tsx`**: A placeholder shown on `ChatPage` for new, empty chat sessions.

**Supporting Files & Stores (High-Level Overview):**

*   **`constants/*`**: Hold static data like `Colors.ts`, `Styles.ts`, `AiProviderModels.ts`, `system_prompt.ts`.
*   **`store/chatStore.ts` (`useChatStore`)**: Manages the active chat's state (messages, current ID, streaming status), DB interactions for chats, and AI communication orchestration. (Detailed in "Zustand State Management")
*   **`store/chatHistoryStore.ts` (`useChatHistoryStore`)**: Manages the list of past chat sessions for the drawer. (Detailed in "Zustand State Management")
*   **`store/mcpStore.ts` (`useMcpStore`)**: Manages MCP server connections and available tools. (Detailed in "Zustand State Management")
*   **`store/notificationStore.ts` (`useNotificationStore`)**: Manages in-app notifications. (Detailed in "Zustand State Management")
*   **`utils/ModelStore.ts`**: Handles secure storage (API keys) and AsyncStorage (preferences, last active chat UUID). (Detailed in "Zustand State Management")
*   **`utils/Database.ts`**: Core module for all SQLite database operations (migrations, CRUD for chats and messages).
*   **`utils/notificationDb.ts`**: Specific SQLite operations for the notifications table.
*   **`utils/ai/AiApiClient.ts`**: Central class for interacting with AI provider APIs (e.g., OpenAI, Groq). Manages client initialization, API calls for chat completions (standard and MCP-enhanced), and streaming responses.
*   **`utils/ai/mcpManager.ts`**: Manages multiple MCP client instances, tool discovery, and connection lifecycle for configured MCP servers.
*   **`utils/ai/mcpClient.ts`**: Client for interacting with a single MCP server.
*   **`utils/ai/mcpToOpenAiConverter.ts`**: Converts MCP tool definitions to the OpenAI function/tool format.
*   **`utils/ai/mcpToolExecutor.ts`**: Executes tool calls requested by the LLM via an MCP server.
*   **`utils/Interfaces.ts`**: Contains common TypeScript interfaces (e.g., `Message`, `Chat`, `ToolCall`).
*   **`providers/ThemeProvider.tsx`**: Manages application theming (light/dark mode).
*   **`config/i18n.ts`**: Internationalization setup.

## OpenAI Integration

The application integrates with various AI providers, including OpenAI-compatible APIs, for its core chat functionality. This is primarily managed through `utils/ai/AiApiClient.ts`.

*   **Central API Client (`utils/ai/AiApiClient.ts`)**: This class is responsible for:
    *   Initializing and managing client instances for different AI providers based on configuration in `constants/AiProviderModels.ts` and API keys from `utils/ModelStore.ts`.
    *   Constructing and sending chat completion requests to the selected AI model.
    *   Handling streaming responses from the AI, providing chunks of data back to `chatStore` for real-time display.
    *   Mapping internal message formats to the format required by the AI provider's API.
    *   Integrating with MCP for tool usage by preparing requests with tool definitions and processing tool call responses (see "Model Context Protocol (MCP) Integration").
*   **Configuration (`constants/AiProviderModels.ts`)**: Defines configurations for various AI providers and their models, including API endpoints.
*   **API Key Management (`utils/ModelStore.ts`)**: Securely stores and retrieves API keys for each configured provider.
*   **Data Flow**: User messages, managed by `chatStore.ts`, are passed to `AiApiClient.ts`. The client then sends the prepared request (potentially augmented with MCP tools and context) to the configured AI provider. The AI's response (streamed or complete) is received by `AiApiClient.ts` and processed by `chatStore.ts` to update the UI and save the message to the local database.

## Model Context Protocol (MCP) Integration

A key goal of the application is to integrate the Model Context Protocol (MCP) to enhance the AI's contextual understanding and tool-using capabilities. The application acts as an MCP Client, enabling the LLM to interact with various MCP Servers.

*   **Objective**: To allow the AI model (via `AiApiClient.ts`) to discover and utilize tools (functions, data sources) exposed by connected MCP Servers. This makes the AI more knowledgeable and capable of performing a wider range of tasks by interacting with external systems.
*   **Reference**: [Model Context Protocol Introduction](https://modelcontextprotocol.io/introduction)
*   **Core Components & Functionality**:
    *   **`utils/ai/mcpManager.ts` (`MCPManager`)**: A singleton class responsible for:
        *   Managing connections to multiple MCP servers defined in `utils/ai/mcp.json`.
        *   Discovering tools available from each connected MCP server using `MCPClient`.
        *   Storing discovered tools and connection statuses in `store/mcpStore.ts`.
        *   Providing an interface for `AiApiClient.ts` to retrieve available tools for the current AI request.
    *   **`utils/ai/mcpClient.ts` (`MCPClient`)**: Handles communication with a single MCP server, including fetching its tool manifest (`/.well-known/mcp.json`).
    *   **`store/mcpStore.ts` (`useMcpStore`)**: A Zustand store that:
        *   Keeps track of the tools discovered from each MCP server and their `isActive` status (user-configurable).
        *   Monitors and stores the connection status (`INITIAL`, `CONNECTING`, `CONNECTED`, `FAILED`, `RECONNECTING`) for each configured MCP server.
    *   **`utils/ai/mcpToOpenAiConverter.ts`**: Contains functions to convert MCP tool definitions (from `McpToolDefinition`) into the format expected by OpenAI-compatible APIs (OpenAI `tools` and `tool_choice` parameters).
    *   **`utils/ai/mcpToolExecutor.ts`**: Responsible for executing a specific tool call requested by the LLM. It takes the tool name and arguments, makes the request to the appropriate MCP server (via `MCPClient` or by directly invoking the server's tool endpoint), and returns the result.
    *   **Integration with `AiApiClient.ts`**: When sending a request to an LLM:
        1.  `AiApiClient.ts` retrieves active tools for configured MCP servers from `MCPManager` (which gets them from `mcpStore`).
        2.  These tools are converted to the OpenAI tool format using `mcpToOpenAiConverter.ts` and included in the API request.
        3.  If the LLM decides to use a tool, its response will include `tool_calls`.
        4.  `AiApiClient.ts` uses `mcpToolExecutor.ts` to execute these tool calls.
        5.  The tool results are sent back to the LLM in a subsequent API call for it to generate a final response.
    *   **Configuration (`utils/ai/mcp.json`)**: A JSON file defining the MCP servers the application should attempt to connect to (e.g., server name and URL).
    *   **User Interface (`app/settings.tsx`)**: The settings screen provides UI for:
        *   Viewing the list of configured MCP servers and their connection status (from `mcpStore`).
        *   Potentially adding/removing MCP server configurations (this functionality might be manual via `mcp.json` or UI-driven).
        *   Toggling the `isActive` state for individual tools discovered from MCP servers (via `mcpStore`).

## Local Data Storage (SQLite) & Session Management

The application employs `expo-sqlite` for robust local data storage, enabling offline access to chat history and ensuring user settings and session continuity. Notifications are also stored locally.

*   **Database Management (`utils/Database.ts`)**: This module is central to all SQLite operations for chat data. It handles:
    *   Database initialization and schema migrations (`migrateDbIfNeeded`).
    *   CRUD (Create, Read, Update, Delete) operations for chat sessions (`chats` table: stores `id` (integer PK), `uuid` (text unique), `title`, timestamps, etc.).
    *   CRUD operations for messages (`messages` table: stores `id` (text PK, UUID), `chat_id` (FK to `chats.id`), `role`, `content`, `timestamp`, `model`, `tool_calls`, etc.).
    *   Helper functions like `getChatIntegerIdByUUID`, `deleteChatAndMessagesByUUID`.
*   **Notification Database (`utils/notificationDb.ts`)**: This module specifically manages SQLite operations for the `notifications` table, including its creation and CRUD operations for notification records.
*   **Chat Session Management (`currentChatId`)**: A core concept is the `currentChatId` (a UUID string), uniquely identifying an active chat session. This is primarily managed by `store/chatStore.ts`.
    *   **Persistence & Restoration**: The `currentChatId` of the *last active session* is persisted by `utils/ModelStore.ts` using AsyncStorage (`setLastActiveChatUUID`, `getLastActiveChatUUID`).
    *   **Initialization (`store/chatStore.ts`)**: Upon application start, `chatStore.initializeDatabase()`:
        1.  Initializes the SQLite database connection via `utils/Database.ts` (and sets it in the store).
        2.  Attempts to load the `lastActiveChatUUID` from `ModelStore.ts`.
        3.  If a `lastActiveChatUUID` is found, `chatStore.setCurrentChatId()` is called to load that session (including its messages from SQLite via `dbGetMessages`).
        4.  If no `lastActiveChatUUID` is found (e.g., first launch), `chatStore.startNewChatSession()` is called. This action:
            *   Creates a new chat entry in the `chats` table (with a new UUID and a default title like "New Chat") via `dbAddChat`.
            *   Sets this new UUID as the `currentChatId` in `chatStore.ts`.
            *   Persists this new UUID as the `lastActiveChatUUID` in `ModelStore.ts`.
    *   **Always Active Session**: This mechanism, orchestrated by `chatStore.ts`, ensures there is always an active `currentChatId`, providing a consistent chat context for the user.
    *   **Starting New Chats**: Users can explicitly start a new chat (e.g., via a "New Chat" button in `CustomDrawerContent.tsx`). This calls `chatStore.startNewChatSession()`, which establishes a new `currentChatId` (saved to DB and `ModelStore`), clears messages from the previous session in the store, and prepares for the new session.
*   **Stored Data Overview**:
    *   **`chats` table (via `utils/Database.ts`)**: Stores records for each chat session (integer `id`, `uuid`, `title`, timestamps).
    *   **`messages` table (via `utils/Database.ts`)**: Stores individual messages with details like `id` (UUID), `chat_id`, `role`, `content`, `timestamp`, `model`, `tool_calls` (JSON), `name` (for tool/user messages), etc. This enables full offline history.
    *   **`notifications` table (via `utils/notificationDb.ts`)**: Stores notification records (see `notificationStore.ts` for structure).
    *   **Secure Storage (`utils/ModelStore.ts` with `expo-secure-store`)**: Securely stores API keys for different AI providers.
    *   **AsyncStorage (`utils/ModelStore.ts` with `@react-native-async-storage/async-storage`)**: Persists user preferences (theme, language, country), the ID of the last selected AI model, the UUID of the last active chat, favorite models, and model temperature.
*   **Benefits**: Provides robust offline access to chat history, ensures user settings and AI configurations are persisted, and offers a seamless continuation of the user's last active chat session across app launches.

## Future Enhancements

Based on the project goals and current architecture, the following features are key areas for future development:

1.  **Searchable Chat History**: Implement robust functionality to search through the locally stored SQLite chat history (`messages` table), allowing users to easily find past conversations or specific messages across all their chat sessions.
2.  **Advanced Model Context Protocol (MCP) Integration**: 
    *   Expand MCP capabilities to support dynamic registration/unregistration of MCP servers through the UI.
    *   Implement more sophisticated context management from various MCP servers, potentially allowing users to select specific tools or data sources for specific queries.
    *   Explore richer tool interaction models beyond basic request/response.
3.  **Background Execution & Push Notifications**: 
    *   For long-running AI operations (e.g., complex tool use or generation tasks), enable background execution so the user can navigate away from the app.
    *   Implement push notifications to alert users of completed background tasks, new messages in a non-active chat, or important system events (e.g., MCP server disconnections if critical).
    *   This will likely require native module integration for robust background processing and notification handling.
4.  **Quick Interactions (CTAs for AI Feedback)**: 
    *   Implement UI elements within `ChatMessage.tsx` (e.g., thumbs up/down, quick replies, copy message) to allow users to easily provide feedback on AI responses or interact with message content.
    *   This feedback could potentially be used locally to refine interactions or (if a mechanism is built) for future model fine-tuning support.
5.  **Continuous UI/UX and Performance Optimization**: 
    *   Continuously optimize rendering performance, especially for long chat lists in `ChatPage.tsx` (leveraging `FlashList` effectively).
    *   Refine data handling and state management in Zustand stores to ensure the app remains extremely fast, leightweight, and responsive.
    *   Further explore code splitting, memoization techniques, and efficient data synchronization strategies between stores and the database.

## Design Guidelines

These guidelines aim to ensure a consistent, accessible, and user-friendly experience throughout the Filipa AI application, focusing on speed and a lightweight feel.

### 1. Centralized Styling

*   **Colors (`constants/Colors.ts`)**: All color definitions MUST reside in `constants/Colors.ts`. Use semantic names (e.g., `primary`, `text`, `background`, `error`) rather than direct color values (e.g., `blue`, `black`). Define light and dark mode variants, managed by `providers/ThemeProvider.tsx`.
*   **Base Styles (`constants/Styles.ts`)**: Common reusable styles (e.g., for containers, buttons, text inputs, standard text sizes, spacing) MUST be defined in `constants/Styles.ts` under an export like `defaultStyles`. Components should import and use these base styles whenever possible to maintain consistency and reduce duplication.
*   **Component-Specific Styles**: Styles unique to a single component should be defined within that component's file using `StyleSheet.create`. Avoid duplicating styles already present in `defaultStyles`.
*   **Theming (`providers/ThemeProvider.tsx`)**: The application uses a `ThemeProvider` to manage themes (e.g., light/dark mode) and apply styles dynamically based on global settings or device preferences. This provider makes theme-specific colors and styles available to components.

### 2. UI/UX Principles

*   **Speed & Responsiveness**: Prioritize performance in all UI interactions. The app must feel extremely fast. Optimize rendering, minimize re-renders, and ensure quick feedback for user actions.
*   **Consistency**: Use defined colors, styles, and components consistently across all screens. Interaction patterns should be predictable and intuitive.
*   **Clarity**: Ensure text is readable, icons are understandable, and layouts are uncluttered. Prioritize information hierarchy to guide the user.
*   **Feedback**: Provide clear visual feedback for user interactions (e.g., button presses, loading states, errors, stream activity). Use toasts or subtle indicators where appropriate.
*   **Simplicity & Lightweightness**: Aim for a clean, intuitive, and minimalist interface. Avoid unnecessary complexity or visual noise. Focus on the core chat functionality, making it efficient and easy to use.

### 3. Typography (Inspired by iA Writer's Responsiveness)

*   **Font Choice**: Select a highly readable font family suitable for long reading sessions and different screen sizes. Font definitions (families, weights) should be managed, potentially within `constants/Styles.ts` or the theme provider.
*   **Reading Distance & Base Size**: Acknowledge that perceived font size depends on viewing distance. The base body text size in `constants/Styles.ts` should be chosen for optimal comfort on the primary target device (phone), potentially larger than traditional print.
*   **Responsive & Consistent Sizing**: Implement adaptive font sizing based on context, defined in `constants/Styles.ts` for various roles:
    *   **Headings**: For screen titles or major section breaks.
    *   **Body Text**: The primary size for chat messages and standard text content.
    *   **Secondary Text/Captions**: Smaller size for timestamps, labels, or less critical info.
*   **Implementation**: Use these predefined sizes from `constants/Styles.ts` or theme. Avoid hardcoding font sizes in components. Dynamic adjustments based on screen width can be achieved using `useWindowDimensions` or responsive styling utilities if necessary, but prioritize respecting system font scaling.
*   **Line Height & Spacing**: Ensure adequate line height (e.g., 1.4-1.6x font size) and paragraph spacing for readability, defined in `constants/Styles.ts` or theme.

### 4. Accessibility (a11y)

*   **Contrast**: Ensure sufficient color contrast between text and background (WCAG AA minimum 4.5:1 for normal text, 3:1 for large text). Use tools to check.
*   **Touch Targets**: Ensure interactive elements (buttons, links, inputs) have a minimum touch target size of 44x44 points.
*   **Semantic Elements & Props**: Use appropriate accessibility props:
    *   `accessibilityLabel`: Descriptive label for elements, especially icons/buttons without text.
    *   `accessibilityRole`: Defines element type (e.g., 'button', 'header', 'listitem').
    *   `accessibilityHint`: Additional context on what an action will do.
    *   `accessibilityState`: Current state (e.g., `{ disabled: true, selected: false }`).
*   **Testing**: Regularly test with screen readers (VoiceOver on iOS, TalkBack on Android) and accessibility inspectors.
*   **Font Scaling**: **Crucially, respect the user's device font size settings.** Use relative units or implement scaling logic for text where appropriate, rather than fixed pixels, to allow text to scale with user preferences. Test layouts thoroughly at various system font sizes.

### 5. Assets

*   **Icons**: Prefer vector icons (e.g., from `@expo/vector-icons`) for scalability and small bundle size. If custom icons are needed, use SVG format.
*   **Images**: Optimize images for mobile. Use appropriate formats (PNG, WebP). Provide `accessibilityLabel` for meaningful images.

## User Journey

This section describes typical user flows within the Filipa AI application, reflecting its core chat functionality, AI provider integration, local storage, session management, and MCP support.

### 1. First-Time Launch & Configuration

1.  **App Launch**: User opens the Filipa AI app for the first time.
2.  **Provider & Store Initialization**: Root components (`app/_layout.tsx`) set up global providers (SQLite, Theme, Toast). `app/index.tsx` initializes `ChatPage` and kicks off MCP connection initialization via `MCPManager.getInstance().initializeAllConnections()`.
3.  **Database Initialization (`ChatPage.tsx` & `chatStore.ts`)**: 
    *   `ChatPage` obtains the SQLite DB instance from `useSQLiteContext()`.
    *   It calls `chatStore.setDbInstance(db)` and then `chatStore.initializeDatabase()`.
    *   `chatStore.initializeDatabase()` migrates the DB schema if needed (`migrateDbIfNeeded` from `utils/Database.ts`).
4.  **Chat Session Check (`chatStore.initializeDatabase`)**:
    *   Checks `ModelStore.getLastActiveChatUUID()`.
    *   If no UUID is found (true for first launch), `chatStore.startNewChatSession()` is called. This creates a new chat record in SQLite, sets the new UUID as `currentChatId` in `chatStore`, and saves it via `ModelStore.setLastActiveChatUUID()`.
5.  **API Key Check (`ChatPage.tsx`)**: 
    *   `ChatPage` checks for any configured API keys via `ModelStore.getApiKey()` for all known providers from `ModelStore.getAllProviderConfigs()`.
    *   If no API keys are found for any provider, `hasApiKey` state in `ChatPage` is set to `false`.
6.  **UI Display (`ChatPage.tsx`)**: 
    *   If `hasApiKey` is `false`, `ApiKeyMissingPlaceholder` is shown, prompting the user to navigate to settings.
    *   If `hasApiKey` is `true` (or becomes true after configuration), and a new chat session was started, `EmptyChatPlaceholder` is shown.
7.  **Navigation to Settings (User Action)**: User navigates to `app/settings.tsx` (e.g., via drawer or prompt from `ApiKeyMissingPlaceholder`).
8.  **API Key Input (`app/settings.tsx`)**: User inputs API Key(s) for one or more AI providers. User might also configure MCP server connections here.
9.  **Save Configuration (`app/settings.tsx` & `ModelStore.ts`)**: API Keys are saved securely via `ModelStore.setApiKey()`. MCP settings are managed via `mcpStore` and potentially persisted if `mcp.json` is dynamically managed.
10. **Return to Chat**: User navigates back to the main chat screen (`app/index.tsx` which hosts `ChatPage`). `ChatPage` re-evaluates `hasApiKey` and displays the chat interface.

### 2. Starting or Resuming a Chat Conversation

1.  **App Launch (Returning User)**: User opens the app. API key(s) are likely configured.
2.  **Initialization (as above)**: Providers, stores, DB, and MCP connections initialize.
3.  **Session Restore (`chatStore.initializeDatabase` & `ChatPage.tsx`)**:
    *   `chatStore.initializeDatabase()` calls `ModelStore.getLastActiveChatUUID()`.
    *   If a UUID exists, `chatStore.setCurrentChatId()` is called (typically triggered by `ChatPage`'s effect if `routeChatId` is not present and store needs to load last active, or if `routeChatId` matches last active).
    *   `chatStore.loadMessages(uuid)` fetches the chat history from SQLite for that `currentChatId` and updates the `messages` array in the store.
    *   If no `lastActiveChatUUID` was stored, `chatStore.startNewChatSession()` ensures a new session is active (as per first launch).
4.  **Load Chat Interface (`ChatPage.tsx`)**: `ChatPage` renders based on `currentChatIdFromStore` and `hasApiKey` status.
5.  **Display Chat**: Messages for the `currentChatId` are rendered. If it's a new session, `EmptyChatPlaceholder` is shown (assuming `hasApiKey` is true).
6.  **Starting a New Chat (e.g., via Drawer)**:
    *   User taps "New Chat" in `components/drawer/CustomDrawerContent.tsx`.
    *   `CustomDrawerContent` calls `chatStore.startNewChatSession()`.
    *   This creates a new chat entry in DB, updates `currentChatId` in `chatStore` and persists it via `ModelStore.setLastActiveChatUUID()`.
    *   The router likely navigates to the main chat screen without a specific `chatId` param, or `ChatPage` re-renders due to `currentChatIdFromStore` change, displaying the new empty chat session.

### 3. Sending a Message & AI Interaction

1.  **User Input**: User types a message into `components/ChatInput.tsx` within `ChatPage.tsx`.
2.  **Send Action**: User presses the send button.
3.  **Message Handling (`ChatPage.handleSendMessage` -> `chatStore.sendMessage`)**: 
    *   `ChatPage` calls `chatStore.sendMessage()` with the message content.
    *   `chatStore.sendMessage()`:
        *   Prepares the user message object, associating it with the current `chatIntegerId` (derived from `currentChatId`).
        *   Optimistically adds the user message and a temporary bot placeholder message to the `messages` array in the store (triggering UI update).
        *   Saves the user's message to SQLite via `dbAddMessage`.
4.  **Prepare for AI Request (`chatStore.sendMessage` -> `AiApiClient`)**:
    *   The full message history for the `currentChatId` (including the new user message) is prepared.
    *   *(MCP Enhancement)*: `AiApiClient.streamChatCompletionWithMcp()` (if MCP is active for the selected model/server) fetches active MCP tools from `MCPManager` (which uses `mcpStore`), converts them to OpenAI format (`mcpToOpenAiConverter`), and includes them in the request payload.
    *   The selected model ID and temperature are retrieved from `ModelStore` (via `chatStore` or directly by `AiApiClient`).
5.  **API Request (`AiApiClient`)**: `AiApiClient` sends the streaming request to the configured AI provider (e.g., OpenAI).
6.  **Loading State (`chatStore.isStreaming`)**: `chatStore` sets `isStreaming` to `true`. UI in `ChatPage`/`ChatHeader` indicates processing.

### 4. Receiving and Displaying AI Response

1.  **Stream Update (`AiApiClient` -> `chatStore`)**: `AiApiClient` receives stream chunks (delta content or tool calls) from the AI provider.
    *   For content chunks: `AiApiClient` calls the `appendStreamChunk` callback provided by `chatStore`.
        *   `chatStore.appendStreamChunk()` updates the content of the last (placeholder) assistant message in the `messages` array.
    *   For tool calls (if MCP was used and LLM requests a tool):
        *   `AiApiClient` accumulates tool call deltas. When `finish_reason` is `tool_calls`, it constructs the assistant message with `tool_calls`.
        *   It then uses `mcpToolExecutor.ts` to execute each tool call against the appropriate MCP server.
        *   The tool results are packaged as `tool` role messages and sent back to the LLM in a new stream request.
        *   The final text response from this second stream is then processed via `appendStreamChunk`.
2.  **Stream End/Error (`AiApiClient` -> `chatStore`)**: 
    *   On stream completion: `AiApiClient` calls `chatStore.handleStreamEnd()`.
        *   `chatStore.handleStreamEnd()` sets `isStreaming` to `false` and saves the complete assistant message (including any tool call info and final content) to SQLite via `dbAddMessage`.
    *   On stream error: `AiApiClient` calls `chatStore.handleStreamError()`.
        *   `chatStore.handleStreamError()` sets `isStreaming` to `false`, potentially updates the placeholder message with an error, and logs/displays the error.
3.  **UI Update (`ChatPage.tsx`)**: `ChatPage` re-renders as `chatStore.messages` and `isStreaming` state change, displaying the AI's response progressively and then in its final state.

### 5. Interacting with Chat History

1.  **View History in Current Chat**: User scrolls within `components/ChatPage.tsx` to view older messages of the `currentChatId`. Messages are rendered using `FlashList` for performance.
2.  **Switch Conversations (Via Drawer - `CustomDrawerContent.tsx`)**:
    *   User opens the navigation drawer, displaying `CustomDrawerContent.tsx`.
    *   The drawer lists recent chats fetched by `chatHistoryStore.loadChatHistories()`.
    *   User selects a past chat session from the list.
    *   `CustomDrawerContent.tsx` calls `router.push('/(app)?chatId='<UUID_OF_SELECTED_CHAT>')` or a similar navigation action.
    *   `app/index.tsx` receives the `chatId` as a route parameter.
    *   `ChatPage.tsx` receives this `routeChatId`. Its effect hook calls `chatStore.setCurrentChatId()` with the selected UUID.
    *   `chatStore.setCurrentChatId()` updates `currentChatId` in its state, persists it to `ModelStore.setLastActiveChatUUID()`, and calls `loadMessages()` for the selected chat. The UI updates to show the selected conversation.

### 6. Managing Settings (`app/settings.tsx`)

1.  **Navigate to Settings**: User accesses `app/settings.tsx` (e.g., via the drawer).
2.  **Update API Keys**: User can view, add, or update API Keys for various AI providers. Changes are saved via `ModelStore.setApiKey()`.
3.  **Manage MCP Connections**: 
    *   User can view configured MCP servers (from `utils/ai/mcp.json` or dynamic config) and their connection status (from `mcpStore.serverConnectionStatus`).
    *   User can toggle the `isActive` status for individual tools discovered from MCP servers (changes updated in `mcpStore.toggleToolActive()`).
    *   Functionality to add/remove MCP server configurations might be present.
4.  **Adjust Preferences**: User can change theme, language, default model temperature, etc. These are saved via relevant functions in `ModelStore.ts`.
