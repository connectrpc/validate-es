# @connectrpc/validate

`@connectrpc/validate` provides a [Connect][connect-es] interceptor that
takes the tedium out of data validation. Rather than hand-writing repetitive
documentation and code &mdash; verifying that `User.email` is valid, or that
`User.age` falls within reasonable bounds &mdash; you can instead encode those
constraints into your Protobuf schemas and automatically enforce them at
runtime.

To get started, head over to the [docs](https://github.com/connectrpc/validate-es) for an introduction.

[connect-es]: https://github.com/connectrpc/connect-es
