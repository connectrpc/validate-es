# @connectrpc/validate Example

This example demonstrates the `@connectrpc/validate` interceptor that automatically validates protobuf messages using [buf.validate](https://buf.build/docs/validate) constraints.

## Running the Example

Start the server:

```sh
npm start
```

The server runs on `http://localhost:8080` and uses the validation interceptor to automatically validate incoming requests.

## Testing with buf curl

### Valid Request

```sh
buf curl --schema proto \
  --data '{"user": {"email": "user@example.com", "name": "John Doe", "age": 25}}' \
  http://localhost:8080/example.v1.UserService/CreateUser
```

### Invalid Email

```sh
buf curl --schema proto \
  --data '{"user": {"email": "not-an-email", "name": "Jane Doe", "age": 30}}' \
  http://localhost:8080/example.v1.UserService/CreateUser
```

### Empty Name

```sh
buf curl --schema proto \
  --data '{"user": {"email": "user@example.com", "name": "", "age": 25}}' \
  http://localhost:8080/example.v1.UserService/CreateUser
```

### Negative Age

```sh
buf curl --schema proto \
  --data '{"user": {"email": "user@example.com", "name": "Bob Smith", "age": -5}}' \
  http://localhost:8080/example.v1.UserService/CreateUser
```

## What You'll See

- ✅ Valid requests pass through and return the created user
- ❌ Invalid requests are rejected with detailed validation error messages
- The validation happens automatically on the server before reaching your handler code

