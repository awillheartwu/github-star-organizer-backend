import { Type } from "@sinclair/typebox";

import { __transformDate__ } from "./__transformDate__";

import { __nullable__ } from "./__nullable__";

export const AiSummaryStyle = Type.Union(
  [Type.Literal("short"), Type.Literal("long")],
  {
    additionalProperties: false,
    description: `历史 AI 摘要（便于追溯不同模型/时间的结果）`,
  },
);
