import { setTimeout } from "node:timers/promises";

import { z } from "zod";

import { coerce, getValueOrDefault } from "./utils.js";

/**
 * Custom error class for HTTP request failures.
 * Contains the response status and body that caused the error.
 */
export class HttpError extends Error {
  /**
   * Constructor for the HttpError class.
   *
   * @param {HttpResponse} response - The response object that caused the error.
   */
  constructor(response) {
    super(`Request to ${response.url} failed with status ${response.statusText}`);

    /**
     * @type {HttpResponse}
     */
    this.cause = response;
    this.name = this.constructor.name;
  }
}

/**
 * @template [T=any]
 */
export class HttpResponse extends Response {
  /**
   * @see {@link Http.ResponseInterceptor}
   * @type {Schema.Custom<Http.ResponseInterceptor>}
   */
  static InterceptorSchema = z.custom(isValidateInterceptor);

  /**
   * An array of response interceptors that will be called before the response is returned
   * from the request. This allows pre-processing or modification of the response.
   *
   * @type {Http.ResponseInterceptor[]}
   */
  interceptors = [];

  /**
   * The content of the HTTP response body as a string.
   *
   * @type {string}
   */
  content = "";

  /**
   * Holds the parsed JSON response data. Defaults to null.
   *
   * @type {T | null}
   */
  data = null;

  /**
   * Creates a new `HttpResponse`.
   *
   * @param {Response}    response - The native Response object.
   * @param {HttpRequest} request  - The HttpRequest that initiated this response.
   */
  constructor(response, request) {
    super(response.body, response);
    /**
     * The `HttpRequest` that initiated this response.
     *
     * @readonly
     * @type     {HttpRequest}
     */
    this.request = request;
  }

  /**
   * Adds response interceptors to the interceptors array.
   *
   * @param   {Http.ResponseInterceptor[]} fns - The interceptor functions to add.
   * @returns {this}
   */
  addInterceptors(...fns) {
    for (const fn of fns) {
      if (!this.interceptors.includes(fn)) {
        this.interceptors.push(fn);
      }
    }

    return this;
  }

  /**
   * Calls all the response interceptors added to the `interceptors` array on the
   * response, allowing pre-processing or modification of the response.
   *
   * It first resolves the response body if needed.
   */
  async intercept() {
    await this.resolveBody();

    for (const interceptor of this.interceptors) {
      await interceptor(this);
    }

    return this;
  }

  /**
   * Resolves the response body by calling `json()` if content type is JSON,
   * or `text()` otherwise. Checks `bodyUsed` first to avoid resolving twice.
   * Returns the response object for chaining.
   *
   * @protected
   * @returns   {Promise<this>}
   */
  async resolveBody() {
    if (!this.bodyUsed) {
      if (this.contentType.includes("json")) {
        await this.json();
        return this;
      }

      await this.text();
      return this;
    }

    return this;
  }

  /**
   * Gets the content-type header from the response headers.
   *
   * @returns {string}
   */
  get contentType() {
    return this.headers.get("content-type") || "";
  }

  /**
   * @inheritdoc
   */
  async json() {
    this.data = JSON.parse(await this.text());

    return this.data;
  }

  /**
   * @inheritdoc
   */
  async text() {
    // @ts-ignore: ¯\_(ツ)_/¯
    this.content = await Response.prototype.text.call(this);

    return this.content;
  }
}

export class HttpRequest extends Request {
  /**
   * @see {@link Http.RequestInterceptor}
   * @type {Schema.Custom<Http.RequestInterceptor>}
   */
  static InterceptorSchema = z.custom(isValidateInterceptor);

  /**
   * An array of request interceptors that will be called before sending the request.
   * This allows pre-processing the request object.
   *
   * @type {Http.RequestInterceptor[]}
   */
  interceptors = [];

  /**
   * Creates a `HttpRequest` instance.
   *
   * @param {string | Request}                input  - A native Request or the url.
   * @param {RequestInit & { json?: string }} [init] - Optional initialization options.
   */
  constructor(input, init = {}) {
    const { body, json, ...rest } = init;

    super(input, { ...rest, body: json || body });

    if (json) {
      if (!this.contentType || !this.contentType.includes("json")) {
        this.headers.set("content-type", "application/json;charset=UTF-8");
      }
    }
  }

  /**
   * Adds request interceptors to the interceptors array.
   *
   * @param   {Http.RequestInterceptor[]} fns - The interceptor functions to add.
   * @returns {this}
   */
  addInterceptors(...fns) {
    for (const fn of fns) {
      if (!this.interceptors.includes(fn)) {
        this.interceptors.push(fn);
      }
    }

    return this;
  }

  /**
   * Gets the content-type header from the request headers.
   *
   * @returns {string | null}
   */
  get contentType() {
    return this.headers.get("content-type") || "";
  }

  /**
   * Gets the total number of headers in the properties.headers Map.
   *
   * @returns {number} The number of headers.
   */
  get totalHeaders() {
    return Array.from(this.headers).length;
  }

  /**
   * Calls all the request interceptors added to the `interceptors` array on the request,
   * allowing pre-processing or modification of the data.
   */
  async intercept() {
    for (const interceptor of this.interceptors) {
      await interceptor(this);
    }

    return this;
  }
}

/**
 * @param   {unknown} value
 * @returns {boolean}
 */
function isValidateInterceptor(value) {
  return typeof value === "function" && value.name !== undefined && value.length > 0;
}

export class HttpClient {
  /**
   * The schema of the configuration for a `HttpClient`
   */
  static ConfigSchema = z.object({
    /**
     * A string indicating how the request will interact with the browser's cache to set
     * request's cache.
     */
    cache: z
      .enum([
        "default",
        "force-cache",
        "no-cache",
        "no-store",
        "only-if-cached",
        "reload",
      ])
      .default("no-cache"),
    /**
     * A string indicating whether credentials will be sent with the request always,
     * never, or only when sent to a same-origin URL. Sets request's credentials.
     */
    credentials: z.enum(["include", "omit", "same-origin"]).optional(),
    /**
     * Sets the delay in milliseconds before sending the request.
     *
     * @default 0
     */
    delay: z.number().min(0).default(0),
    /**
     * A Headers object, an object literal, or an array of two-item arrays to set
     * request's headers.
     */
    headers: z
      .instanceof(Headers)
      .or(
        z.record(z.string()).transform(function createHeaders(value) {
          return new Headers(value);
        }),
      )
      .default(() => new Headers()),
    /**
     * A cryptographic hash of the resource to be fetched by request. Sets request's
     * integrity.
     */
    integrity: z.string().optional(),
    /**
     * A boolean to set request's keepalive.
     */
    keepalive: z.boolean().default(false),
    /**
     * A string to indicate whether the request will use CORS, or will be restricted to
     * same-origin URLs. Sets request's mode.
     */
    mode: z.enum(["same-origin", "cors", "navigate", "no-cors"]).default("no-cors"),
    /**
     * A string indicating whether request follows redirects, results in an error upon
     * encountering a redirect, or returns the redirect (in an opaque fashion). Sets
     * request's redirect.
     */
    redirect: z.enum(["error", "follow", "manual"]).default("follow"),
    /**
     * A string whose value is a same-origin URL, "about:client", or the empty string,
     * to set request's referrer.
     */
    referrer: z.string().default(""),
    /**
     * A referrer policy to set request's referrerPolicy.
     */
    referrerPolicy: z
      .enum([
        "",
        "same-origin",
        "no-referrer",
        "no-referrer-when-downgrade",
        "origin",
        "origin-when-cross-origin",
        "strict-origin",
        "strict-origin-when-cross-origin",
        "unsafe-url",
      ])
      .default(""),
    /**
     * An AbortSignal to set request's signal.
     */
    signal: z.instanceof(AbortSignal).optional(),
    /**
     * The origin URL of the request.
     */
    origin: z
      .string()
      .url()
      .transform(function cleanUrl(value) {
        if (value.endsWith("/")) {
          return value.substring(0, value.length - 1);
        }

        return value;
      })
      .optional(),
    /**
     * The path of the URL to make the request to.
     */
    path: z.string().startsWith("/").default("/"),
    /**
     * A string indicating the method of the request.
     */
    method: z
      .enum([
        "get",
        "GET",
        "head",
        "HEAD",
        "options",
        "OPTIONS",
        "trace",
        "TRACE",
        "connect",
        "CONNECT",
        "delete",
        "DELETE",
        "post",
        "POST",
        "put",
        "PUT",
        "patch",
        "PATCH",
      ])
      .default("GET"),
    /**
     * A JSON request body.
     */
    json: z
      .object({})
      .passthrough()
      .optional()
      .transform((x) => JSON.stringify(x))
      .or(
        z.string().refine((value) => {
          try {
            JSON.parse(value);
            return true;
          } catch {
            return false;
          }
        }, "Not a valid JSON body."),
      ),
    /**
     * A BodyInit object or null to set request's body.
     */
    body: z
      .instanceof(Blob)
      .or(z.instanceof(ArrayBuffer))
      .or(z.instanceof(FormData))
      .or(z.instanceof(URLSearchParams))
      .or(z.string())
      .nullable()
      .default(null),
  });

  /**
   * The schema for interceptors configuration.
   */
  static InterceptorsSchema = z.object({
    request: z.array(HttpRequest.InterceptorSchema).default([]),
    response: z.array(HttpResponse.InterceptorSchema).default([]),
  });

  /**
   * The default configuration options for HTTP requests.
   *
   * @type {Http.ConfigInput}
   */
  static defaults = {};

  /**
   * The default configuration options for HTTP requests.
   *
   * @type {Http.InterceptorsInput}
   */
  static interceptors = {
    request: [],
    response: [],
  };

  /**
   * Creates a new instance of the Http class with the given configuration and
   * interceptors.
   *
   * @type {Http.CreateFn}
   */
  static create(config = {}, interceptors = {}) {
    // @ts-ignore:  ̄\_(ツ)_/ ̄
    return new this(config, interceptors);
  }

  /**
   * Sends an HTTP request with the given configuration and returns the response.
   * Applies any request/response interceptors that are provided.
   *
   * @type {Http.SendFunction}
   */
  static async send($config = {}, $interceptors = {}) {
    const { origin, path, delay, ...init } = this.ConfigSchema.parse(
      this.mergeConfig(this.defaults, $config),
    );
    const interceptors = this.InterceptorsSchema.parse(
      this.mergeInterceptors(this.interceptors, $interceptors),
    );

    const request = new HttpRequest(origin + path, init).addInterceptors(
      ...interceptors.request,
    );

    await request.intercept();

    const response = new HttpResponse(await fetch(request), request).addInterceptors(
      ...interceptors.response,
    );

    if (!response.ok) {
      throw new HttpError(response);
    }

    await response.intercept();

    await setTimeout(delay);

    return response;
  }

  /**
   * Sends a GET request.
   *
   * @type {Http.SendFunction<true>}
   */
  static get(config = {}, interceptors) {
    return this.send({ ...config, method: "GET" }, interceptors);
  }

  /**
   * Sends a POST request.
   *
   * @type {Http.SendFunction<true>}
   */
  static post(config = {}, interceptors) {
    return this.send({ ...config, method: "POST" }, interceptors);
  }

  // #region HttpClient - Protected static methods

  /**
   * @protected
   * @param     {Http.ConfigInput} config
   */
  static defineDefaults(config) {
    this.defaults = this.mergeConfig(this.defaults, config);
  }

  /**
   * @protected
   * @param     {Http.InterceptorsInput} interceptors
   */
  static defineInterceptors(interceptors) {
    this.interceptors = this.mergeInterceptors(this.interceptors, interceptors);
  }

  /**
   * Merges two interceptor configurations into a single interceptor object.
   *
   * @protected
   * @param     {Http.InterceptorsInput} a - First interceptor configuration.
   * @param     {Http.InterceptorsInput} b - Second interceptor configuration.
   * @returns   {Http.Interceptors}      Merged interceptors.
   */
  static mergeInterceptors(a, b) {
    /**
     * @type {Http.Interceptors}
     */
    const interceptors = {
      request: [],
      response: [],
    };
    const requestInterceptors = [
      ...getValueOrDefault(a.request, interceptors.request),
      ...getValueOrDefault(b.request, interceptors.request),
    ];
    const responseInterceptors = [
      ...getValueOrDefault(a.response, interceptors.response),
      ...getValueOrDefault(b.response, interceptors.response),
    ];

    for (const reqInterceptor of requestInterceptors) {
      if (!interceptors.request.includes(reqInterceptor)) {
        interceptors.request.push(reqInterceptor);
      }
    }

    for (const resInterceptor of responseInterceptors) {
      if (!interceptors.response.includes(resInterceptor)) {
        interceptors.response.push(resInterceptor);
      }
    }

    return interceptors;
  }

  /**
   * Merges two HTTP configuration objects together.
   *
   * @protected
   * @param     {Http.ConfigInput} a
   * @param     {Http.ConfigInput} b
   * @returns   {Http.ConfigInput}
   */
  static mergeConfig(a, b) {
    const { headers: aHeaders, ...aRest } = a;
    const { headers: bHeaders, ...bRest } = b;

    const headers = this.mergeHeaders(aHeaders, bHeaders);

    return Object.assign({ headers }, aRest, bRest);
  }

  /**
   * Merges two headers objects into a single Headers instance.
   *
   * @protected
   * @param     {Http.HeadersInput} [a]
   * @param     {Http.HeadersInput} [b]
   * @returns   {Headers}
   */
  static mergeHeaders(a, b) {
    const headers = new Headers();

    if (a instanceof Headers) {
      this.setToHeaders(headers, [...a.entries()]);
    } else if (typeof a === "object") {
      this.setToHeaders(headers, Object.entries(a));
    }

    if (b instanceof Headers) {
      this.setToHeaders(headers, [...b.entries()]);
    } else if (typeof b === "object") {
      this.setToHeaders(headers, Object.entries(b));
    }

    return headers;
  }

  /**
   * Sets HTTP header entries on a Headers instance.
   *
   * @protected
   * @param     {Headers}            headers
   * @param     {[string, string][]} entries
   * @returns   {Headers}            The Headers instance with entries set.
   */
  static setToHeaders(headers, entries) {
    for (const entry of entries) {
      headers.set(entry[0], entry[1]);
    }

    return headers;
  }

  // #endregion HttpClient - Protected static methods

  /**
   * @param {Http.ConfigInput}       config
   * @param {Http.InterceptorsInput} [interceptors]
   */
  constructor(config, interceptors = {}) {
    /**
     * Default configuration for this `HttpClient`.
     */
    this.defaults = this.super.mergeConfig(this.super.defaults, config);

    /**
     * Request and response interceptors for this `HttpClient`.
     */
    this.interceptors = this.super.mergeInterceptors(
      this.super.interceptors,
      interceptors,
    );
  }

  /**
   * Sends an HTTP request with the given configuration and returns the response.
   * Applies any request/response interceptors that are provided.
   *
   * @type {Http.SendFunction}
   */
  send(config = {}, interceptors = {}) {
    return this.super.send(
      this.super.mergeConfig(this.defaults, config),
      this.super.mergeInterceptors(this.interceptors, interceptors),
    );
  }

  /**
   * Sends a GET request.
   *
   * @type {Http.SendFunction<true>}
   */
  get(config = {}, interceptors = {}) {
    return this.super.get(
      this.super.mergeConfig(this.defaults, config),
      this.super.mergeInterceptors(this.interceptors, interceptors),
    );
  }

  /**
   * Sends a POST request.
   *
   * @type {Http.SendFunction<true>}
   */
  post(config = {}, interceptors = {}) {
    return this.super.post(
      this.super.mergeConfig(this.defaults, config),
      this.super.mergeInterceptors(this.interceptors, interceptors),
    );
  }

  /**
   * Forks the current `HttpClient` instance with the given configuration and interceptors
   * merged from the defaults.
   *
   * @type {Http.ForkFn}
   */
  fork(config = {}, interceptors = {}) {
    const mergedConfig = this.super.mergeConfig(this.defaults, config);
    const mergedInterceptors = this.super.mergeInterceptors(
      this.interceptors,
      interceptors,
    );

    // @ts-ignore: ¯\_(ツ)_/¯
    return this.super.create(mergedConfig, mergedInterceptors);
  }

  // #region HttpClient - Protected methods

  /**
   * Gets the parent class of this instance.
   * This allows accessing static properties/methods from the child class.
   *
   * @protected
   * @returns   {typeof HttpClient} The parent class.
   */
  get super() {
    return coerce(this.constructor);
  }

  // #endregion HttpClient - Protected methods
}
