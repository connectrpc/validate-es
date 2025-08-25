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
}

/**
 * Creates an Interceptor that ensures that RPC request messages match the constraints
 * expressed in their Protobuf schemas. It does not validate response messages.
 *
 * By default, the Interceptor uses a validator that is created using `createValidator`
 * without any options. To use a different validator use the `validator` option.
 *
 * RPCs with invalid request messages short-circuit with an error.
 * The error always uses Code.InvalidArgument and has a detailed representation
 * of the error attached as a error detail.
 *
 * This interceptor is primarily intended for use on handlers.
 * Client-side use is possible, but discouraged unless the client
 * always has an up-to-date schema.
 */
export function createValidateInterceptor(
  opt?: ValidateInterceptorOptions,
): Interceptor {
  const validator = opt?.validator ?? createValidator();
  return (next) => {
    return (req) => {
      if (req.stream === false) {
        validate(validator, req.method.input, req.message);
        return next(req);
      }
      return next({
        ...req,
        message: {
          [Symbol.asyncIterator]: () => {
            const it = req.message[Symbol.asyncIterator]();
            const validateIt: AsyncIterator<Message> = {
              async next(...[value]: [] | [unknown]) {
                const next = await it.next(value);
                if (next.value) {
                  validate(validator, req.method.input, next.value);
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
    };
  };
}

function validate(validator: Validator, desc: DescMessage, msg: Message) {
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
    Code.InvalidArgument,
    undefined,
    details,
    result.error,
  );
}
