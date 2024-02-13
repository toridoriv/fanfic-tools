import { Logger } from "tslog";
import { z } from "zod";

import { coerce, lazyPick } from "./utils.js";

const LOG_LEVELS = Object.freeze({
  silly: 0,
  SILLY: 0,
  trace: 1,
  TRACE: 1,
  debug: 2,
  DEBUG: 2,
  info: 3,
  INFO: 3,
  warn: 4,
  WARN: 4,
  error: 5,
  ERROR: 5,
  fatal: 6,
  FATAL: 6,
});

/**
 * @type {Schema.Custom<ValueOf<typeof LOG_LEVELS>>}
 */
const LogLevelSchema = coerce(
  z
    .custom(function (value) {
      return typeof value === "string" && value in LOG_LEVELS;
    })
    .default("INFO")
    .catch("INFO")
    .transform(lazyPick(LOG_LEVELS)),
);

const LOG_LEVEL = LogLevelSchema.parse(process.env.LOG_LEVEL);

export const logger = new Logger({
  minLevel: LOG_LEVEL,
  overwrite: {
    mask(args) {
      return args;
    },
  },
  type: "pretty",
});

/**
 * @typedef {ValueOf<typeof LOG_LEVELS>} L
 */
