# Validate

[![License](https://img.shields.io/github/license/connectrpc/validate-es?color=blue)](./LICENSE)
[![Build](https://github.com/connectrpc/validate-es/actions/workflows/ci.yaml/badge.svg?branch=main)](https://github.com/connectrpc/validate-es/actions/workflows/ci.yaml)
[![NPM Version](https://img.shields.io/npm/v/@connectrpc/validate/latest?color=green&label=%40connectrpc%2Fvalidate)](https://www.npmjs.com/package/@connectrpc/validate)

[@connectrpc/validate](https://www.npmjs.com/package/@connectrpc/validate) 
provides a [Connect][connect-es] interceptor that
takes the tedium out of data validation. Rather than hand-writing repetitive
documentation and code &mdash; verifying that `User.email` is valid, or that
`User.age` falls within reasonable bounds &mdash; you can instead encode those
constraints into your Protobuf schemas and automatically enforce them at
runtime.

Under the hood, this package is powered by [protovalidate][protovalidate-es]
and the [Common Expression Language][cel-spec]. Together, they make validation
flexible, efficient, and consistent across languages _without_ additional code
generation.

## Installation

```bash
npm install @connectrpc/validate
```

## A small example

Curious what all this looks like in practice? First, let's define a schema for
our user service:

```protobuf
syntax = "proto3";

package example.user.v1;

import "buf/validate/validate.proto";
import "google/protobuf/timestamp.proto";

message User {
  // Simple constraints, like checking that an email address is valid, are
  // predefined.
  string email = 1 [(buf.validate.field).string.email = true];

  // For more complex use cases, like comparing fields against each other, we
  // can write a CEL expression.
  google.protobuf.Timestamp birth_date = 2;
  google.protobuf.Timestamp signup_date = 3;

  option (buf.validate.message).cel = {
    id: "user.signup_date",
    message: "signup date must be on or after birth date",
    expression: "this.signup_date >= this.birth_date"
  };
}

message CreateUserRequest {
  User user = 1;
}

message CreateUserResponse {
  User user = 1;
}

service UserService {
  rpc CreateUser(CreateUserRequest) returns (CreateUserResponse) {}
}
```

Notice that simple constraints, like checking email addresses, are short and
declarative. When we need a more elaborate constraint, we can write a custom
CEL expression, customize the error message, and much more. (See [the
main protovalidate repository][protovalidate] for more examples.)

After implementing `UserService`, we can add a validating interceptor with just
one import:

```typescript
import { createServer } from "node:http";
import { connectNodeAdapter } from "@connectrpc/connect-node";
import { createValidateInterceptor } from "@connectrpc/validate";
import { UserService } from "./gen/example/v1/user_pb.js";

const server = createServer(
  connectNodeAdapter({
    interceptors: [createValidateInterceptor()],
    routes: ({ rpc }) => {
      rpc(UserService.method.createUser, async (req) => {
        // Request is already validated - no need for boilerplate!
        return {
          user: req.user,
        };
      });
    },
  }),
);

server.listen(8080, () => {
  console.log("Server listening on http://localhost:8080");
});
```

With the `createValidateInterceptor()` applied, our `UserService` implementation can
assume that all requests have already been validated &mdash; no need for
hand-written boilerplate!

## FAQ

### Does this interceptor work with Connect clients?

Yes: it validates request messages before sending them to the server. But
unless you're _sure_ that your clients always have an up-to-date schema, it's
better to let the server handle validation.

### How do clients know which fields are invalid?

If the request message fails validation, the interceptor returns an error coded
with `Code.InvalidArgument`. It also adds a detailed representation of the
validation error(s) as an error detail.

### How should schemas import protovalidate's options?

Because this interceptor uses [protovalidate][protovalidate-es], it doesn't
need any generated code for validation. However, any Protobuf schemas with
constraints must import [`buf/validate/validate.proto`][validate.proto]. It's
easiest to import this file directly from the [Buf Schema
Registry][bsr]: this repository contains an [example
schema](./packages/example/proto/example/v1/user.proto) with constraints,
[buf.yaml](./packages/example/buf.yaml) and [buf.gen.yaml](./packages/example/buf.gen.yaml)
configuration files, and the npm script `generate`.

### Does the interceptor validate responses?

By default, on both clients and servers, the interceptor only validates requests. If you'd additionally like to validate responses, use the `validateResponses` option when constructing your interceptor.

```typescript
createValidateInterceptor({ validateResponses: true })
```

Response validation failures use `Code.Internal` rather than `Code.InvalidArgument`.

## Ecosystem

* [connect-es]: the Connect runtime
* [protovalidate-es]: the underlying Protobuf validation library
* [protovalidate]: schemas and documentation for the constraint language
* [CEL][cel-spec]: the Common Expression Language

## Status: Unstable

This module is unstable. Expect breaking changes as we iterate toward a stable
release.

This project follows semantic versioning. Once we tag
a stable release, we will _not_ make breaking changes without incrementing the
major version.


## License

Offered under the [Apache 2 license](LICENSE).

[bsr]: https://buf.build
[cel-spec]: https://github.com/google/cel-spec
[connect-es]: https://github.com/connectrpc/connect-es
[protovalidate-es]: https://github.com/bufbuild/protovalidate-es
[protovalidate]: https://github.com/bufbuild/protovalidate
[validate.proto]: https://github.com/bufbuild/protovalidate/blob/main/proto/protovalidate/buf/validate/validate.proto
