import type * as http from "./http.js";
import type { ZodType, ZodTypeAny, ZodTypeDef, input, output } from "zod";

declare global {
  /**
   * Represents a value that may be a direct value or a Promise that resolves to that
   * value.
   */
  type MaybePromise<T> = T | Promise<T>;

  /**
   * Types related to making HTTP requests and configuring a HTTP client.
   *
   * @namespace Http
   */
  namespace Http {
    /**
     * Represents the output type of the HTTP client configuration schema.
     * This maps the configuration input type to the format expected by the HTTP client.
     */
    type Config = Schema.Output<(typeof http.HttpClient)["ConfigSchema"]>;

    /**
     * Represents the input type for the HTTP client configuration.
     */
    type ConfigInput = Schema.Input<(typeof http.HttpClient)["ConfigSchema"]>;

    /**
     * Represents a `HttpRequest`.
     *
     * @see {@link http.HttpRequest}
     */
    type Request = http.HttpRequest;

    /**
     * Represents a generic `HttpResponse`.
     *
     * @see {@link http.HttpResponse}
     */
    type Response<T = any> = http.HttpResponse<T>;

    /**
     * Represents the possible types that can be used to specify headers for an HTTP
     * request.
     */
    type HeadersInput = Headers | Record<string, string>;

    /**
     * Represents the input type for the HTTP interceptors configuration.
     */
    type InterceptorsInput = Schema.Input<(typeof http.HttpClient)["InterceptorsSchema"]>;

    /**
     * Represents a function for intercepting HTTP requests. A request interceptor must
     * always receive a `HttpRequest` and return the same value or a promise resolving to
     * the value.
     *
     * The purpose of this interceptor function is to allow modifying, logging, or
     * validating requests before they are sent over the network. For example, you could
     * add headers to the request.
     */
    type RequestInterceptor = (
      request: http.HttpRequest,
    ) => MaybePromise<http.HttpRequest>;

    /**
     * Represents a function for intercepting HTTP responses. A response interceptor must
     * always receive a `HttpResponse` and return the same value or a promise resolving to
     * the value.
     *
     * The purpose of this interceptor function is to allow modifying, logging, or
     * validating responses before they are returned. For example, you could transform the
     * response body.
     */
    type ResponseInterceptor = (
      response: http.HttpResponse,
    ) => MaybePromise<http.HttpResponse>;

    /**
     * Represents a function for sending HTTP requests.
     */
    export type SendFunction<OmitMethod = false> = <T>(
      config: OmitMethod extends true ? Omit<ConfigInput, "method"> : ConfigInput,
      interceptors?: InterceptorsInput,
    ) => Promise<Response<T>>;
  }

  /**
   * Types related to schema definitions.
   *
   * @namespace Schema
   */
  namespace Schema {
    /**
     * Represents any possible schema.
     */
    type Any = ZodTypeAny;

    /**
     * Represents a custom schema, with generic type parameters for the expected input and
     * expect output types.
     */
    type Custom<Input, Output = Input> = ZodType<Output, ZodTypeDef, Input>;

    /**
     * Gets the input type for the given schema.
     */
    type Input<S extends Any> = input<S>;

    /**
     * Gets the output type for the given schema.
     */
    type Output<S extends Any> = output<S>;
  }
}
