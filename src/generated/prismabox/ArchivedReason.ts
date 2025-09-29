import { Type } from "@sinclair/typebox";

import { __transformDate__ } from "./__transformDate__";

import { __nullable__ } from "./__nullable__";

export const ArchivedReason = Type.Union(
  [Type.Literal("manual"), Type.Literal("unstarred")],
  { additionalProperties: false, description: `归档原因` },
);
