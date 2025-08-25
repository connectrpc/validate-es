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

import { createServer } from "node:http";
import { connectNodeAdapter } from "@connectrpc/connect-node";
import { createValidateInterceptor } from "@connectrpc/validate";
import { UserService } from "./gen/example/v1/user_pb.js";

const server = createServer(
  connectNodeAdapter({
    interceptors: [createValidateInterceptor()],
    routes: ({ rpc }) => {
      rpc(UserService.method.createUser, async (req) => {
        return {
          user: req.user,
        };
      });
    },
  }),
);

server.listen(8080, () => {
  console.log("Server listening on http://localhost:8080");
  console.log(
    "The server uses the validate interceptor to automatically validate incoming requests",
  );
});
