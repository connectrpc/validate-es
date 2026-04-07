// Copyright 2025 The Connect Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Code, ConnectError, type Interceptor } from "@connectrpc/connect";
import {
  createValidator,
  type Validator,
  violationsToProto,
} from "@bufbuild/protovalidate";
import type { DescMessage, Message } from "@bufbuild/protobuf";

/**
 * Options to configure the interceptor.
 */
interface ValidateInterceptorOptions {
  /**
   * The Validator to use.
   *
   * If not provided, it will create a validator.
   */
  validator?: Validator;
  /**
   * Whether to also validate response messages.
   *
   * By default, only request messages are validated. When this is set to true,
   * unary response messages and each message in a response stream are also
   * validated. Response validation failures use Code.Internal.
   */
  validateResponses?: boolean;
}

/**
 * Creates an Interceptor that ensures that RPC request messages match the constraints
 * expressed in their Protobuf schemas.
 *
 * By default, the Interceptor uses a validator that is created using `createValidator`
 * without any options. To use a different validator use the `validator` option.
 *
 * RPCs with invalid request messages short-circuit with an error.
 * The error always uses Code.InvalidArgument and has a detailed representation
 * of the error attached as a error detail.
 *
 * By default, only request messages are validated. To also validate response
 * messages, set the `validateResponses` option to true. Response validation
 * failures use Code.Internal.
 *
 * This interceptor is primarily intended for use on handlers.
 * Client-side use is possible, but discouraged unless the client
 * always has an up-to-date schema.
 */
export function createValidateInterceptor(
  opt?: ValidateInterceptorOptions,
): Interceptor {
  const validator = opt?.validator ?? createValidator();
  // Whether to validate response messages in addition to requests.
  const validateResponses = opt?.validateResponses ?? false;
  return (next) => {
    return async (req) => {
      if (req.stream === false) {
        // Validate the unary request message.
        validate(
          validator,
          req.method.input,
          req.message,
          Code.InvalidArgument,
        );
        const res = await next(req);
        // Validate the unary response message if configured.
        if (validateResponses && res.stream === false) {
          validate(validator, req.method.output, res.message, Code.Internal);
        }
        return res;
      }
      // Wrap the request stream to validate each message as it arrives.
      const res = await next({
        ...req,
        message: {
          [Symbol.asyncIterator]: () => {
            const it = req.message[Symbol.asyncIterator]();
            const validateIt: AsyncIterator<Message> = {
              async next(...[value]: [] | [unknown]) {
                const next = await it.next(value);
                if (next.value) {
                  validate(
                    validator,
                    req.method.input,
                    next.value,
                    Code.InvalidArgument,
                  );
                }
                return next;
              },
            };
            if (it.return) {
              validateIt.return = (value?: unknown) =>
                (it as Required<typeof it>).return(value);
            }
            if (it.throw) {
              validateIt.throw = (value?: unknown) =>
                (it as Required<typeof it>).throw(value);
            }
            return validateIt;
          },
        },
      });
      // Wrap the response stream to validate each message if configured.
      if (validateResponses && res.stream === true) {
        return {
          ...res,
          message: {
            [Symbol.asyncIterator]: () => {
              const it = res.message[Symbol.asyncIterator]();
              const validateIt: AsyncIterator<Message> = {
                async next(...[value]: [] | [unknown]) {
                  const next = await it.next(value);
                  if (next.value) {
                    validate(
                      validator,
                      req.method.output,
                      next.value,
                      Code.Internal,
                    );
                  }
                  return next;
                },
              };
              if (it.return) {
                validateIt.return = (value?: unknown) =>
                  (it as Required<typeof it>).return(value);
              }
              if (it.throw) {
                validateIt.throw = (value?: unknown) =>
                  (it as Required<typeof it>).throw(value);
              }
              return validateIt;
            },
          },
        };
      }
      return res;
    };
  };
}

function validate(
  validator: Validator,
  desc: DescMessage,
  msg: Message,
  code: Code,
) {
  const result = validator.validate(desc, msg);
  if (result.kind === "valid") {
    return;
  }
  const details: { desc: DescMessage; value: Message }[] = [];
  if (result.violations) {
    const [value, desc] = violationsToProto(result.violations);
    details.push({ desc, value });
  }
  throw new ConnectError(
    result.error.message,
    code,
    undefined,
    details,
    result.error,
  );
}
