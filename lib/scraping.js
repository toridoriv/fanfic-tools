import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { load } from "@toridoriv/cheerio";

import { HttpClient } from "./http.js";
import { coerce } from "./utils.js";

/**
 * Web scraper HTTP client.
 */
export class WebScraper extends HttpClient {
  static CACHE_DIR = "";
  static ENABLE_CACHE = process.env.ENABLE_CACHE === "true";

  static {
    this.defineDefaults({
      headers: {
        "content-type": "text/html; charset=utf-8",
      },
    });
  }

  /**
   * Converts HTML string to a Cheerio static object.
   * This allows for jQuery-like manipulation and querying of the HTML content.
   * If a URL is provided, it sets the base URL for the document, which can be useful for
   * resolving relative paths.
   *
   * @param   {string}              html  The HTML content as a string.
   * @param   {string | URL}        [url] Optional base URL to be used for resolving
   *                                      relative paths within the HTML content.
   * @returns {Scraping.CheerioAPI} A Cheerio static object representing the loaded
   *                                HTML content.
   */
  static toCheerio(html, url) {
    return load(html, {
      baseURI: url,
      sourceCodeLocationInfo: true,
    });
  }

  /**
   * @protected
   * @param     {string}          html
   * @param     {string | URL}    [url]
   * @returns   {Scraping.Result}
   */
  static buildResult(html, url) {
    return {
      source: html,
      $: this.toCheerio(html, url),
    };
  }

  /**
   * @protected
   * @param     {URL}    url
   * @returns   {string}
   */
  static getCacheId(url) {
    return url.pathname.substring(1);
  }

  /**
   * @protected
   * @param     {string} id
   * @returns   {string}
   */
  static getPathToCache(id) {
    return `${this.CACHE_DIR}/${id}.html`;
  }

  /**
   * Checks if a cache file exists for the given ID.
   *
   * @param   {string}  id - The ID to check for a cached file.
   * @returns {boolean} `true` if a cached file exists for the given ID,
   *                    `false` otherwise.
   */
  static hasCache(id) {
    return existsSync(this.getPathToCache(id));
  }

  /**
   * Retrieves HTML content from the cache for the given ID.
   *
   * @param   {string}          id - The ID of the cached content to retrieve.
   * @returns {Scraping.Result} An object with a Cheerio wrapper and the raw HTML
   *                            source of the scraped page.
   */
  static getFromCache(id) {
    return this.buildResult(readHtmlFromCache(this.CACHE_DIR, id));
  }

  /**
   * Performs web scraping based on the provided configuration.
   *
   * This method sends an HTTP request using the given configuration and then processes
   * the response to extract HTML content. It utilizes the `WebScraper.toCheerio` method
   * to convert the HTML source into a Cheerio object, allowing for jQuery-like
   * manipulation.
   *
   * @param   {Http.ConfigInput}         config The HTTP client configuration for the
   *                                            request.
   * @returns {Promise<Scraping.Result>} An object with a Cheerio wrapper and the
   *                                     raw HTML source of the scraped page.
   */
  async scrape(config) {
    const response = await this.send(config);

    return this.super.buildResult(response.content);
  }

  /**
   * Gets the parent class of this instance.
   * This allows accessing static properties/methods from the child class.
   *
   * @protected
   * @returns   {typeof WebScraper} The parent class.
   */
  get super() {
    return coerce(this.constructor);
  }
}

/**
 * Writes the HTML content from the response to the cache.
 *
 * @this    {typeof WebScraper}
 * @param   {Http.Response}     response - The response object.
 * @returns {Http.Response}     The original response object.
 */
export function writeHtmlToCacheInterceptor(response) {
  // @ts-ignore: ¯\_(ツ)_/¯
  const id = this.getCacheId(new URL(response.request.url));

  // @ts-ignore: ¯\_(ツ)_/¯
  writeHtmlToCache(this.CACHE_DIR, id, response.content);

  return response;
}

/**
 * Saves HTML content to the cache directory.
 *
 * @param   {string} dir     - The directory within the cache folder to save the file.
 * @param   {string} name    - The name of the file without the file extension.
 * @param   {string} content - The HTML content to save.
 * @returns {void}
 */
export function writeHtmlToCache(dir, name, content) {
  mkdirSync(dir, { recursive: true });

  const path = `${dir}/${name}.html`;

  return writeFileSync(path, content, "utf-8");
}

/**
 * Reads HTML content from the cache directory.
 *
 * @param   {string} dir  - The directory within the cache folder to read the file from.
 * @param   {string} name - The name of the file without the file extension to read.
 * @returns {string} The HTML content read from the cache file.
 */
export function readHtmlFromCache(dir, name) {
  const path = `${dir}/${name}.html`;

  return readFileSync(path, "utf-8");
}
