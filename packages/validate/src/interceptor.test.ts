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

import {
  Code,
  ConnectError,
  createClient,
  createRouterTransport,
  type ConnectRouter,
} from "@connectrpc/connect";
import { suite, test } from "node:test";
import * as assert from "node:assert/strict";
import { CumSumRequestSchema, TestService } from "./gen/test_pb.js";
import { createValidateInterceptor } from "./interceptor.js";
import { createAsyncIterable } from "@connectrpc/connect/protocol";
import { create } from "@bufbuild/protobuf";

void suite("createValidateInterceptor()", () => {
  const client = createClient(
    TestService,
    createRouterTransport(
      ({ service }: ConnectRouter) => {
        service(TestService, {
          createUser: () => ({}),
          cumSum: async (req) => {
            for await (const _ of req) {
            }
            return {};
          },
        });
      },
      {
        router: { interceptors: [createValidateInterceptor()] },
      },
    ),
  );
  void test("rejects invalid unary rpcs", async () => {
    await assert.rejects(
      () => client.createUser({ user: { email: "not an email" } }),
      (err) => {
        const cErr = ConnectError.from(err);
        assert.equal(cErr.code, Code.InvalidArgument);
        assert.equal(cErr.details.length > 0, true);
        return true;
      },
    );
  });
  void test("allows valid unary rpcs", async () => {
    await assert.doesNotReject(() =>
      client.createUser({ user: { email: "abc@example.com" } }),
    );
  });
  void test("rejects invalid streaming rpcs", async () => {
    await assert.rejects(
      () => client.cumSum(createAsyncIterable([{}])),
      (err) => {
        const cErr = ConnectError.from(err);
        assert.equal(cErr.code, Code.InvalidArgument);
        assert.equal(cErr.details.length > 0, true);
        return true;
      },
    );
  });
  void test("allows valid streaming rpcs", async () => {
    await assert.doesNotReject(() =>
      client.cumSum(
        createAsyncIterable([create(CumSumRequestSchema, { number: 1n })]),
      ),
    );
  });
});
