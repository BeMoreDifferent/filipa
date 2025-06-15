# Building a Minimal MCP Client with SSE in React Native (Expo)

## Overview of MCP and SSE Transport

The **Model Context Protocol (MCP)** uses JSON-RPC 2.0 as its underlying message format for requests, responses, and notifications. An MCP client connects to an MCP server over a chosen transport. In our case we use **Server-Sent Events (SSE)**, which provides a lightweight one-way streaming channel from server to client. The MCP specification defines SSE as a standard transport where the server pushes events over an HTTP SSE stream, and the client sends its messages via HTTP POST requests. This fits well in React Native (Expo) because it avoids complex WebSocket setup and works with plain HTTP. We will rely on **no external libraries**, only the fetch/XHR capabilities of React Native, and use simple header or URL parameter tokens for authentication (e.g. an `Authorization` header or `?api_key=...` query param), instead of any OAuth flows.




# OFFICIAL IMPLEMENTATION PARTS

## AUTH

``import pkceChallenge from "pkce-challenge";
import { LATEST_PROTOCOL_VERSION } from "../types.js";
import type { OAuthClientMetadata, OAuthClientInformation, OAuthTokens, OAuthMetadata, OAuthClientInformationFull } from "../shared/auth.js";
import { OAuthClientInformationFullSchema, OAuthMetadataSchema, OAuthTokensSchema } from "../shared/auth.js";

/**
 * Implements an end-to-end OAuth client to be used with one MCP server.
 * 
 * This client relies upon a concept of an authorized "session," the exact
 * meaning of which is application-defined. Tokens, authorization codes, and
 * code verifiers should not cross different sessions.
 */
export interface OAuthClientProvider {
  /**
   * The URL to redirect the user agent to after authorization.
   */
  get redirectUrl(): string | URL;

  /**
   * Metadata about this OAuth client.
   */
  get clientMetadata(): OAuthClientMetadata;

  /**
   * Loads information about this OAuth client, as registered already with the
   * server, or returns `undefined` if the client is not registered with the
   * server.
   */
  clientInformation(): OAuthClientInformation | undefined | Promise<OAuthClientInformation | undefined>;

  /**
   * If implemented, this permits the OAuth client to dynamically register with
   * the server. Client information saved this way should later be read via
   * `clientInformation()`.
   * 
   * This method is not required to be implemented if client information is
   * statically known (e.g., pre-registered).
   */
  saveClientInformation?(clientInformation: OAuthClientInformationFull): void | Promise<void>;

  /**
   * Loads any existing OAuth tokens for the current session, or returns
   * `undefined` if there are no saved tokens.
   */
  tokens(): OAuthTokens | undefined | Promise<OAuthTokens | undefined>;

  /**
   * Stores new OAuth tokens for the current session, after a successful
   * authorization.
   */
  saveTokens(tokens: OAuthTokens): void | Promise<void>;

  /**
   * Invoked to redirect the user agent to the given URL to begin the authorization flow.
   */
  redirectToAuthorization(authorizationUrl: URL): void | Promise<void>;

  /**
   * Saves a PKCE code verifier for the current session, before redirecting to
   * the authorization flow.
   */
  saveCodeVerifier(codeVerifier: string): void | Promise<void>;

  /**
   * Loads the PKCE code verifier for the current session, necessary to validate
   * the authorization result.
   */
  codeVerifier(): string | Promise<string>;
}

export type AuthResult = "AUTHORIZED" | "REDIRECT";

export class UnauthorizedError extends Error {
  constructor(message?: string) {
    super(message ?? "Unauthorized");
  }
}

/**
 * Orchestrates the full auth flow with a server.
 * 
 * This can be used as a single entry point for all authorization functionality,
 * instead of linking together the other lower-level functions in this module.
 */
export async function auth(
  provider: OAuthClientProvider,
  { serverUrl, authorizationCode }: { serverUrl: string | URL, authorizationCode?: string }): Promise<AuthResult> {
  const metadata = await discoverOAuthMetadata(serverUrl);

  // Handle client registration if needed
  let clientInformation = await Promise.resolve(provider.clientInformation());
  if (!clientInformation) {
    if (authorizationCode !== undefined) {
      throw new Error("Existing OAuth client information is required when exchanging an authorization code");
    }

    if (!provider.saveClientInformation) {
      throw new Error("OAuth client information must be saveable for dynamic registration");
    }

    const fullInformation = await registerClient(serverUrl, {
      metadata,
      clientMetadata: provider.clientMetadata,
    });

    await provider.saveClientInformation(fullInformation);
    clientInformation = fullInformation;
  }

  // Exchange authorization code for tokens
  if (authorizationCode !== undefined) {
    const codeVerifier = await provider.codeVerifier();
    const tokens = await exchangeAuthorization(serverUrl, {
      metadata,
      clientInformation,
      authorizationCode,
      codeVerifier,
      redirectUri: provider.redirectUrl,
    });

    await provider.saveTokens(tokens);
    return "AUTHORIZED";
  }

  const tokens = await provider.tokens();

  // Handle token refresh or new authorization
  if (tokens?.refresh_token) {
    try {
      // Attempt to refresh the token
      const newTokens = await refreshAuthorization(serverUrl, {
        metadata,
        clientInformation,
        refreshToken: tokens.refresh_token,
      });

      await provider.saveTokens(newTokens);
      return "AUTHORIZED";
    } catch (error) {
      console.error("Could not refresh OAuth tokens:", error);
    }
  }

  // Start new authorization flow
  const { authorizationUrl, codeVerifier } = await startAuthorization(serverUrl, {
    metadata,
    clientInformation,
    redirectUrl: provider.redirectUrl,
    scope: provider.clientMetadata.scope
  });

  await provider.saveCodeVerifier(codeVerifier);
  await provider.redirectToAuthorization(authorizationUrl);
  return "REDIRECT";
}

/**
 * Looks up RFC 8414 OAuth 2.0 Authorization Server Metadata.
 *
 * If the server returns a 404 for the well-known endpoint, this function will
 * return `undefined`. Any other errors will be thrown as exceptions.
 */
export async function discoverOAuthMetadata(
  serverUrl: string | URL,
  opts?: { protocolVersion?: string },
): Promise<OAuthMetadata | undefined> {
  const url = new URL("/.well-known/oauth-authorization-server", serverUrl);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "MCP-Protocol-Version": opts?.protocolVersion ?? LATEST_PROTOCOL_VERSION
      }
    });
  } catch (error) {
    // CORS errors come back as TypeError
    if (error instanceof TypeError) {
      response = await fetch(url);
    } else {
      throw error;
    }
  }

  if (response.status === 404) {
    return undefined;
  }

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} trying to load well-known OAuth metadata`,
    );
  }

  return OAuthMetadataSchema.parse(await response.json());
}

/**
 * Begins the authorization flow with the given server, by generating a PKCE challenge and constructing the authorization URL.
 */
export async function startAuthorization(
  serverUrl: string | URL,
  {
    metadata,
    clientInformation,
    redirectUrl,
    scope,
  }: {
    metadata?: OAuthMetadata;
    clientInformation: OAuthClientInformation;
    redirectUrl: string | URL;
    scope?: string;
  },
): Promise<{ authorizationUrl: URL; codeVerifier: string }> {
  const responseType = "code";
  const codeChallengeMethod = "S256";

  let authorizationUrl: URL;
  if (metadata) {
    authorizationUrl = new URL(metadata.authorization_endpoint);

    if (!metadata.response_types_supported.includes(responseType)) {
      throw new Error(
        `Incompatible auth server: does not support response type ${responseType}`,
      );
    }

    if (
      !metadata.code_challenge_methods_supported ||
      !metadata.code_challenge_methods_supported.includes(codeChallengeMethod)
    ) {
      throw new Error(
        `Incompatible auth server: does not support code challenge method ${codeChallengeMethod}`,
      );
    }
  } else {
    authorizationUrl = new URL("/authorize", serverUrl);
  }

  // Generate PKCE challenge
  const challenge = await pkceChallenge();
  const codeVerifier = challenge.code_verifier;
  const codeChallenge = challenge.code_challenge;

  authorizationUrl.searchParams.set("response_type", responseType);
  authorizationUrl.searchParams.set("client_id", clientInformation.client_id);
  authorizationUrl.searchParams.set("code_challenge", codeChallenge);
  authorizationUrl.searchParams.set(
    "code_challenge_method",
    codeChallengeMethod,
  );
  authorizationUrl.searchParams.set("redirect_uri", String(redirectUrl));
  
  if (scope) {
    authorizationUrl.searchParams.set("scope", scope);
  }

  return { authorizationUrl, codeVerifier };
}

/**
 * Exchanges an authorization code for an access token with the given server.
 */
export async function exchangeAuthorization(
  serverUrl: string | URL,
  {
    metadata,
    clientInformation,
    authorizationCode,
    codeVerifier,
    redirectUri,
  }: {
    metadata?: OAuthMetadata;
    clientInformation: OAuthClientInformation;
    authorizationCode: string;
    codeVerifier: string;
    redirectUri: string | URL;
  },
): Promise<OAuthTokens> {
  const grantType = "authorization_code";

  let tokenUrl: URL;
  if (metadata) {
    tokenUrl = new URL(metadata.token_endpoint);

    if (
      metadata.grant_types_supported &&
      !metadata.grant_types_supported.includes(grantType)
    ) {
      throw new Error(
        `Incompatible auth server: does not support grant type ${grantType}`,
      );
    }
  } else {
    tokenUrl = new URL("/token", serverUrl);
  }

  // Exchange code for tokens
  const params = new URLSearchParams({
    grant_type: grantType,
    client_id: clientInformation.client_id,
    code: authorizationCode,
    code_verifier: codeVerifier,
    redirect_uri: String(redirectUri),
  });

  if (clientInformation.client_secret) {
    params.set("client_secret", clientInformation.client_secret);
  }

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: HTTP ${response.status}`);
  }

  return OAuthTokensSchema.parse(await response.json());
}

/**
 * Exchange a refresh token for an updated access token.
 */
export async function refreshAuthorization(
  serverUrl: string | URL,
  {
    metadata,
    clientInformation,
    refreshToken,
  }: {
    metadata?: OAuthMetadata;
    clientInformation: OAuthClientInformation;
    refreshToken: string;
  },
): Promise<OAuthTokens> {
  const grantType = "refresh_token";

  let tokenUrl: URL;
  if (metadata) {
    tokenUrl = new URL(metadata.token_endpoint);

    if (
      metadata.grant_types_supported &&
      !metadata.grant_types_supported.includes(grantType)
    ) {
      throw new Error(
        `Incompatible auth server: does not support grant type ${grantType}`,
      );
    }
  } else {
    tokenUrl = new URL("/token", serverUrl);
  }

  // Exchange refresh token
  const params = new URLSearchParams({
    grant_type: grantType,
    client_id: clientInformation.client_id,
    refresh_token: refreshToken,
  });

  if (clientInformation.client_secret) {
    params.set("client_secret", clientInformation.client_secret);
  }

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: HTTP ${response.status}`);
  }

  return OAuthTokensSchema.parse(await response.json());
}

/**
 * Performs OAuth 2.0 Dynamic Client Registration according to RFC 7591.
 */
export async function registerClient(
  serverUrl: string | URL,
  {
    metadata,
    clientMetadata,
  }: {
    metadata?: OAuthMetadata;
    clientMetadata: OAuthClientMetadata;
  },
): Promise<OAuthClientInformationFull> {
  let registrationUrl: URL;

  if (metadata) {
    if (!metadata.registration_endpoint) {
      throw new Error("Incompatible auth server: does not support dynamic client registration");
    }

    registrationUrl = new URL(metadata.registration_endpoint);
  } else {
    registrationUrl = new URL("/register", serverUrl);
  }

  const response = await fetch(registrationUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(clientMetadata),
  });

  if (!response.ok) {
    throw new Error(`Dynamic client registration failed: HTTP ${response.status}`);
  }

  return OAuthClientInformationFullSchema.parse(await response.json());
}``

```


## SSE

```
import { EventSource, type ErrorEvent, type EventSourceInit } from "eventsource";
import { Transport } from "../shared/transport.js";
import { JSONRPCMessage, JSONRPCMessageSchema } from "../types.js";
import { auth, AuthResult, OAuthClientProvider, UnauthorizedError } from "./auth.js";

export class SseError extends Error {
  constructor(
    public readonly code: number | undefined,
    message: string | undefined,
    public readonly event: ErrorEvent,
  ) {
    super(`SSE error: ${message}`);
  }
}

/**
 * Configuration options for the `SSEClientTransport`.
 */
export type SSEClientTransportOptions = {
  /**
   * An OAuth client provider to use for authentication.
   * 
   * When an `authProvider` is specified and the SSE connection is started:
   * 1. The connection is attempted with any existing access token from the `authProvider`.
   * 2. If the access token has expired, the `authProvider` is used to refresh the token.
   * 3. If token refresh fails or no access token exists, and auth is required, `OAuthClientProvider.redirectToAuthorization` is called, and an `UnauthorizedError` will be thrown from `connect`/`start`.
   * 
   * After the user has finished authorizing via their user agent, and is redirected back to the MCP client application, call `SSEClientTransport.finishAuth` with the authorization code before retrying the connection.
   * 
   * If an `authProvider` is not provided, and auth is required, an `UnauthorizedError` will be thrown.
   * 
   * `UnauthorizedError` might also be thrown when sending any message over the SSE transport, indicating that the session has expired, and needs to be re-authed and reconnected.
   */
  authProvider?: OAuthClientProvider;

  /**
   * Customizes the initial SSE request to the server (the request that begins the stream).
   * 
   * NOTE: Setting this property will prevent an `Authorization` header from
   * being automatically attached to the SSE request, if an `authProvider` is
   * also given. This can be worked around by setting the `Authorization` header
   * manually.
   */
  eventSourceInit?: EventSourceInit;

  /**
   * Customizes recurring POST requests to the server.
   */
  requestInit?: RequestInit;
};

/**
 * Client transport for SSE: this will connect to a server using Server-Sent Events for receiving
 * messages and make separate POST requests for sending messages.
 */
export class SSEClientTransport implements Transport {
  private _eventSource?: EventSource;
  private _endpoint?: URL;
  private _abortController?: AbortController;
  private _url: URL;
  private _eventSourceInit?: EventSourceInit;
  private _requestInit?: RequestInit;
  private _authProvider?: OAuthClientProvider;

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  constructor(
    url: URL,
    opts?: SSEClientTransportOptions,
  ) {
    this._url = url;
    this._eventSourceInit = opts?.eventSourceInit;
    this._requestInit = opts?.requestInit;
    this._authProvider = opts?.authProvider;
  }

  private async _authThenStart(): Promise<void> {
    if (!this._authProvider) {
      throw new UnauthorizedError("No auth provider");
    }

    let result: AuthResult;
    try {
      result = await auth(this._authProvider, { serverUrl: this._url });
    } catch (error) {
      this.onerror?.(error as Error);
      throw error;
    }

    if (result !== "AUTHORIZED") {
      throw new UnauthorizedError();
    }

    return await this._startOrAuth();
  }

  private async _commonHeaders(): Promise<HeadersInit> {
    const headers: HeadersInit = {};
    if (this._authProvider) {
      const tokens = await this._authProvider.tokens();
      if (tokens) {
        headers["Authorization"] = `Bearer ${tokens.access_token}`;
      }
    }

    return headers;
  }

  private _startOrAuth(): Promise<void> {
    return new Promise((resolve, reject) => {
      this._eventSource = new EventSource(
        this._url.href,
        this._eventSourceInit ?? {
          fetch: (url, init) => this._commonHeaders().then((headers) => fetch(url, {
            ...init,
            headers: {
              ...headers,
              Accept: "text/event-stream"
            }
          })),
        },
      );
      this._abortController = new AbortController();

      this._eventSource.onerror = (event) => {
        if (event.code === 401 && this._authProvider) {
          this._authThenStart().then(resolve, reject);
          return;
        }

        const error = new SseError(event.code, event.message, event);
        reject(error);
        this.onerror?.(error);
      };

      this._eventSource.onopen = () => {
        // The connection is open, but we need to wait for the endpoint to be received.
      };

      this._eventSource.addEventListener("endpoint", (event: Event) => {
        const messageEvent = event as MessageEvent;

        try {
          this._endpoint = new URL(messageEvent.data, this._url);
          if (this._endpoint.origin !== this._url.origin) {
            throw new Error(
              `Endpoint origin does not match connection origin: ${this._endpoint.origin}`,
            );
          }
        } catch (error) {
          reject(error);
          this.onerror?.(error as Error);

          void this.close();
          return;
        }

        resolve();
      });

      this._eventSource.onmessage = (event: Event) => {
        const messageEvent = event as MessageEvent;
        let message: JSONRPCMessage;
        try {
          message = JSONRPCMessageSchema.parse(JSON.parse(messageEvent.data));
        } catch (error) {
          this.onerror?.(error as Error);
          return;
        }

        this.onmessage?.(message);
      };
    });
  }

  async start() {
    if (this._eventSource) {
      throw new Error(
        "SSEClientTransport already started! If using Client class, note that connect() calls start() automatically.",
      );
    }

    return await this._startOrAuth();
  }

  /**
   * Call this method after the user has finished authorizing via their user agent and is redirected back to the MCP client application. This will exchange the authorization code for an access token, enabling the next connection attempt to successfully auth.
   */
  async finishAuth(authorizationCode: string): Promise<void> {
    if (!this._authProvider) {
      throw new UnauthorizedError("No auth provider");
    }

    const result = await auth(this._authProvider, { serverUrl: this._url, authorizationCode });
    if (result !== "AUTHORIZED") {
      throw new UnauthorizedError("Failed to authorize");
    }
  }

  async close(): Promise<void> {
    this._abortController?.abort();
    this._eventSource?.close();
    this.onclose?.();
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (!this._endpoint) {
      throw new Error("Not connected");
    }

    try {
      const commonHeaders = await this._commonHeaders();
      const headers = new Headers({ ...commonHeaders, ...this._requestInit?.headers });
      headers.set("content-type", "application/json");
      const init = {
        ...this._requestInit,
        method: "POST",
        headers,
        body: JSON.stringify(message),
        signal: this._abortController?.signal,
      };

      const response = await fetch(this._endpoint, init);
      if (!response.ok) {
        if (response.status === 401 && this._authProvider) {
          const result = await auth(this._authProvider, { serverUrl: this._url });
          if (result !== "AUTHORIZED") {
            throw new UnauthorizedError();
          }

          // Purposely _not_ awaited, so we don't call onerror twice
          return this.send(message);
        }

        const text = await response.text().catch(() => null);
        throw new Error(
          `Error POSTing to endpoint (HTTP ${response.status}): ${text}`,
        );
      }
    } catch (error) {
      this.onerror?.(error as Error);
      throw error;
    }
  }
}
```


## streamableHttp


````
import { Transport } from "../shared/transport.js";
import { isInitializedNotification, isJSONRPCRequest, isJSONRPCResponse, JSONRPCMessage, JSONRPCMessageSchema } from "../types.js";
import { auth, AuthResult, OAuthClientProvider, UnauthorizedError } from "./auth.js";
import { EventSourceParserStream } from "eventsource-parser/stream";

// Default reconnection options for StreamableHTTP connections
const DEFAULT_STREAMABLE_HTTP_RECONNECTION_OPTIONS: StreamableHTTPReconnectionOptions = {
  initialReconnectionDelay: 1000,
  maxReconnectionDelay: 30000,
  reconnectionDelayGrowFactor: 1.5,
  maxRetries: 2,
};

export class StreamableHTTPError extends Error {
  constructor(
    public readonly code: number | undefined,
    message: string | undefined,
  ) {
    super(`Streamable HTTP error: ${message}`);
  }
}

/**
 * Options for starting or authenticating an SSE connection
 */
interface StartSSEOptions {
  /**
   * The resumption token used to continue long-running requests that were interrupted.
   *
   * This allows clients to reconnect and continue from where they left off.
   */
  resumptionToken?: string;

  /**
   * A callback that is invoked when the resumption token changes.
   *
   * This allows clients to persist the latest token for potential reconnection.
   */
  onresumptiontoken?: (token: string) => void;

  /**
  * Override Message ID to associate with the replay message
  * so that response can be associate with the new resumed request.
  */
  replayMessageId?: string | number;
}

/**
 * Configuration options for reconnection behavior of the StreamableHTTPClientTransport.
 */
export interface StreamableHTTPReconnectionOptions {
  /**
   * Maximum backoff time between reconnection attempts in milliseconds.
   * Default is 30000 (30 seconds).
   */
  maxReconnectionDelay: number;

  /**
   * Initial backoff time between reconnection attempts in milliseconds.
   * Default is 1000 (1 second).
   */
  initialReconnectionDelay: number;

  /**
   * The factor by which the reconnection delay increases after each attempt.
   * Default is 1.5.
   */
  reconnectionDelayGrowFactor: number;

  /**
   * Maximum number of reconnection attempts before giving up.
   * Default is 2.
   */
  maxRetries: number;
}

/**
 * Configuration options for the `StreamableHTTPClientTransport`.
 */
export type StreamableHTTPClientTransportOptions = {
  /**
   * An OAuth client provider to use for authentication.
   *
   * When an `authProvider` is specified and the connection is started:
   * 1. The connection is attempted with any existing access token from the `authProvider`.
   * 2. If the access token has expired, the `authProvider` is used to refresh the token.
   * 3. If token refresh fails or no access token exists, and auth is required, `OAuthClientProvider.redirectToAuthorization` is called, and an `UnauthorizedError` will be thrown from `connect`/`start`.
   *
   * After the user has finished authorizing via their user agent, and is redirected back to the MCP client application, call `StreamableHTTPClientTransport.finishAuth` with the authorization code before retrying the connection.
   *
   * If an `authProvider` is not provided, and auth is required, an `UnauthorizedError` will be thrown.
   *
   * `UnauthorizedError` might also be thrown when sending any message over the transport, indicating that the session has expired, and needs to be re-authed and reconnected.
   */
  authProvider?: OAuthClientProvider;

  /**
   * Customizes HTTP requests to the server.
   */
  requestInit?: RequestInit;

  /**
   * Options to configure the reconnection behavior.
   */
  reconnectionOptions?: StreamableHTTPReconnectionOptions;

  /**
   * Session ID for the connection. This is used to identify the session on the server.
   * When not provided and connecting to a server that supports session IDs, the server will generate a new session ID.
   */
  sessionId?: string;
};

/**
 * Client transport for Streamable HTTP: this implements the MCP Streamable HTTP transport specification.
 * It will connect to a server using HTTP POST for sending messages and HTTP GET with Server-Sent Events
 * for receiving messages.
 */
export class StreamableHTTPClientTransport implements Transport {
  private _abortController?: AbortController;
  private _url: URL;
  private _requestInit?: RequestInit;
  private _authProvider?: OAuthClientProvider;
  private _sessionId?: string;
  private _reconnectionOptions: StreamableHTTPReconnectionOptions;

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  constructor(
    url: URL,
    opts?: StreamableHTTPClientTransportOptions,
  ) {
    this._url = url;
    this._requestInit = opts?.requestInit;
    this._authProvider = opts?.authProvider;
    this._sessionId = opts?.sessionId;
    this._reconnectionOptions = opts?.reconnectionOptions ?? DEFAULT_STREAMABLE_HTTP_RECONNECTION_OPTIONS;
  }

  private async _authThenStart(): Promise<void> {
    if (!this._authProvider) {
      throw new UnauthorizedError("No auth provider");
    }

    let result: AuthResult;
    try {
      result = await auth(this._authProvider, { serverUrl: this._url });
    } catch (error) {
      this.onerror?.(error as Error);
      throw error;
    }

    if (result !== "AUTHORIZED") {
      throw new UnauthorizedError();
    }

    return await this._startOrAuthSse({ resumptionToken: undefined });
  }

  private async _commonHeaders(): Promise<Headers> {
    const headers: HeadersInit = {};
    if (this._authProvider) {
      const tokens = await this._authProvider.tokens();
      if (tokens) {
        headers["Authorization"] = `Bearer ${tokens.access_token}`;
      }
    }

    if (this._sessionId) {
      headers["mcp-session-id"] = this._sessionId;
    }

    return new Headers(
      { ...headers, ...this._requestInit?.headers }
    );
  }


  private async _startOrAuthSse(options: StartSSEOptions): Promise<void> {
    const { resumptionToken } = options;
    try {
      // Try to open an initial SSE stream with GET to listen for server messages
      // This is optional according to the spec - server may not support it
      const headers = await this._commonHeaders();
      headers.set("Accept", "text/event-stream");

      // Include Last-Event-ID header for resumable streams if provided
      if (resumptionToken) {
        headers.set("last-event-id", resumptionToken);
      }

      const response = await fetch(this._url, {
        method: "GET",
        headers,
        signal: this._abortController?.signal,
      });

      if (!response.ok) {
        if (response.status === 401 && this._authProvider) {
          // Need to authenticate
          return await this._authThenStart();
        }

        // 405 indicates that the server does not offer an SSE stream at GET endpoint
        // This is an expected case that should not trigger an error
        if (response.status === 405) {
          return;
        }

        throw new StreamableHTTPError(
          response.status,
          `Failed to open SSE stream: ${response.statusText}`,
        );
      }

      this._handleSseStream(response.body, options);
    } catch (error) {
      this.onerror?.(error as Error);
      throw error;
    }
  }


  /**
   * Calculates the next reconnection delay using  backoff algorithm
   * 
   * @param attempt Current reconnection attempt count for the specific stream
   * @returns Time to wait in milliseconds before next reconnection attempt
   */
  private _getNextReconnectionDelay(attempt: number): number {
    // Access default values directly, ensuring they're never undefined
    const initialDelay = this._reconnectionOptions.initialReconnectionDelay;
    const growFactor = this._reconnectionOptions.reconnectionDelayGrowFactor;
    const maxDelay = this._reconnectionOptions.maxReconnectionDelay;

    // Cap at maximum delay
    return Math.min(initialDelay * Math.pow(growFactor, attempt), maxDelay);

  }

  /**
   * Schedule a reconnection attempt with exponential backoff
   * 
   * @param lastEventId The ID of the last received event for resumability
   * @param attemptCount Current reconnection attempt count for this specific stream
   */
  private _scheduleReconnection(options: StartSSEOptions, attemptCount = 0): void {
    // Use provided options or default options
    const maxRetries = this._reconnectionOptions.maxRetries;

    // Check if we've exceeded maximum retry attempts
    if (maxRetries > 0 && attemptCount >= maxRetries) {
      this.onerror?.(new Error(`Maximum reconnection attempts (${maxRetries}) exceeded.`));
      return;
    }

    // Calculate next delay based on current attempt count
    const delay = this._getNextReconnectionDelay(attemptCount);

    // Schedule the reconnection
    setTimeout(() => {
      // Use the last event ID to resume where we left off
      this._startOrAuthSse(options).catch(error => {
        this.onerror?.(new Error(`Failed to reconnect SSE stream: ${error instanceof Error ? error.message : String(error)}`));
        // Schedule another attempt if this one failed, incrementing the attempt counter
        this._scheduleReconnection(options, attemptCount + 1);
      });
    }, delay);
  }

  private _handleSseStream(stream: ReadableStream<Uint8Array> | null, options: StartSSEOptions): void {
    if (!stream) {
      return;
    }
    const { onresumptiontoken, replayMessageId } = options;

    let lastEventId: string | undefined;
    const processStream = async () => {
      // this is the closest we can get to trying to catch network errors
      // if something happens reader will throw
      try {
        // Create a pipeline: binary stream -> text decoder -> SSE parser
        const reader = stream
          .pipeThrough(new TextDecoderStream())
          .pipeThrough(new EventSourceParserStream())
          .getReader();


        while (true) {
          const { value: event, done } = await reader.read();
          if (done) {
            break;
          }

          // Update last event ID if provided
          if (event.id) {
            lastEventId = event.id;
            onresumptiontoken?.(event.id);
          }

          if (!event.event || event.event === "message") {
            try {
              const message = JSONRPCMessageSchema.parse(JSON.parse(event.data));
              if (replayMessageId !== undefined && isJSONRPCResponse(message)) {
                message.id = replayMessageId;
              }
              this.onmessage?.(message);
            } catch (error) {
              this.onerror?.(error as Error);
            }
          }
        }
      } catch (error) {
        // Handle stream errors - likely a network disconnect
        this.onerror?.(new Error(`SSE stream disconnected: ${error}`));

        // Attempt to reconnect if the stream disconnects unexpectedly and we aren't closing
        if (this._abortController && !this._abortController.signal.aborted) {
          // Use the exponential backoff reconnection strategy
          if (lastEventId !== undefined) {
            try {
              this._scheduleReconnection({
                resumptionToken: lastEventId,
                onresumptiontoken,
                replayMessageId
              }, 0);
            }
            catch (error) {
              this.onerror?.(new Error(`Failed to reconnect: ${error instanceof Error ? error.message : String(error)}`));

            }
          }
        }
      }
    };
    processStream();
  }

  async start() {
    if (this._abortController) {
      throw new Error(
        "StreamableHTTPClientTransport already started! If using Client class, note that connect() calls start() automatically.",
      );
    }

    this._abortController = new AbortController();
  }

  /**
   * Call this method after the user has finished authorizing via their user agent and is redirected back to the MCP client application. This will exchange the authorization code for an access token, enabling the next connection attempt to successfully auth.
   */
  async finishAuth(authorizationCode: string): Promise<void> {
    if (!this._authProvider) {
      throw new UnauthorizedError("No auth provider");
    }

    const result = await auth(this._authProvider, { serverUrl: this._url, authorizationCode });
    if (result !== "AUTHORIZED") {
      throw new UnauthorizedError("Failed to authorize");
    }
  }

  async close(): Promise<void> {
    // Abort any pending requests
    this._abortController?.abort();

    this.onclose?.();
  }

  async send(message: JSONRPCMessage | JSONRPCMessage[], options?: { resumptionToken?: string, onresumptiontoken?: (token: string) => void }): Promise<void> {
    try {
      const { resumptionToken, onresumptiontoken } = options || {};

      if (resumptionToken) {
        // If we have at last event ID, we need to reconnect the SSE stream
        this._startOrAuthSse({ resumptionToken, replayMessageId: isJSONRPCRequest(message) ? message.id : undefined }).catch(err => this.onerror?.(err));
        return;
      }

      const headers = await this._commonHeaders();
      headers.set("content-type", "application/json");
      headers.set("accept", "application/json, text/event-stream");

      const init = {
        ...this._requestInit,
        method: "POST",
        headers,
        body: JSON.stringify(message),
        signal: this._abortController?.signal,
      };

      const response = await fetch(this._url, init);

      // Handle session ID received during initialization
      const sessionId = response.headers.get("mcp-session-id");
      if (sessionId) {
        this._sessionId = sessionId;
      }

      if (!response.ok) {
        if (response.status === 401 && this._authProvider) {
          const result = await auth(this._authProvider, { serverUrl: this._url });
          if (result !== "AUTHORIZED") {
            throw new UnauthorizedError();
          }

          // Purposely _not_ awaited, so we don't call onerror twice
          return this.send(message);
        }

        const text = await response.text().catch(() => null);
        throw new Error(
          `Error POSTing to endpoint (HTTP ${response.status}): ${text}`,
        );
      }

      // If the response is 202 Accepted, there's no body to process
      if (response.status === 202) {
        // if the accepted notification is initialized, we start the SSE stream
        // if it's supported by the server
        if (isInitializedNotification(message)) {
          // Start without a lastEventId since this is a fresh connection
          this._startOrAuthSse({ resumptionToken: undefined }).catch(err => this.onerror?.(err));
        }
        return;
      }

      // Get original message(s) for detecting request IDs
      const messages = Array.isArray(message) ? message : [message];

      const hasRequests = messages.filter(msg => "method" in msg && "id" in msg && msg.id !== undefined).length > 0;

      // Check the response type
      const contentType = response.headers.get("content-type");

      if (hasRequests) {
        if (contentType?.includes("text/event-stream")) {
          // Handle SSE stream responses for requests
          // We use the same handler as standalone streams, which now supports
          // reconnection with the last event ID
          this._handleSseStream(response.body, { onresumptiontoken });
        } else if (contentType?.includes("application/json")) {
          // For non-streaming servers, we might get direct JSON responses
          const data = await response.json();
          const responseMessages = Array.isArray(data)
            ? data.map(msg => JSONRPCMessageSchema.parse(msg))
            : [JSONRPCMessageSchema.parse(data)];

          for (const msg of responseMessages) {
            this.onmessage?.(msg);
          }
        } else {
          throw new StreamableHTTPError(
            -1,
            `Unexpected content type: ${contentType}`,
          );
        }
      }
    } catch (error) {
      this.onerror?.(error as Error);
      throw error;
    }
  }

  get sessionId(): string | undefined {
    return this._sessionId;
  }

  /**
   * Terminates the current session by sending a DELETE request to the server.
   * 
   * Clients that no longer need a particular session
   * (e.g., because the user is leaving the client application) SHOULD send an
   * HTTP DELETE to the MCP endpoint with the Mcp-Session-Id header to explicitly
   * terminate the session.
   * 
   * The server MAY respond with HTTP 405 Method Not Allowed, indicating that
   * the server does not allow clients to terminate sessions.
   */
  async terminateSession(): Promise<void> {
    if (!this._sessionId) {
      return; // No session to terminate
    }

    try {
      const headers = await this._commonHeaders();

      const init = {
        ...this._requestInit,
        method: "DELETE",
        headers,
        signal: this._abortController?.signal,
      };

      const response = await fetch(this._url, init);

      // We specifically handle 405 as a valid response according to the spec,
      // meaning the server does not support explicit session termination
      if (!response.ok && response.status !== 405) {
        throw new StreamableHTTPError(
          response.status,
          `Failed to terminate session: ${response.statusText}`
        );
      }

      this._sessionId = undefined;
    } catch (error) {
      this.onerror?.(error as Error);
      throw error;
    }
  }
}
```