# 双身份狼人 平衡模拟

由 `node scripts/werewolfBalance.js` 生成。中等水平启发式 AI：预言家公开报验人，村民按共识投票（无信息时 35% 概率投中狼），狼人抱团并优先刀预言家，守卫守预言家，女巫首夜救人、毒被指认的狼，金刚狼刀预言家或第二晚起使用。

每格：推荐牌组 + 好人胜率（2000 局复测）。规则键依次为 order / wake / doubleWolf / mute / win。

| 规则 | 5 人 | 6 人 | 7 人 | 8 人 | 9 人 | 10 人 |
|---|---|---|---|---|---|---|
| choose|top|no|no|side | 狼2预女猎守 46% | 狼2预女猎 51% | 狼2预女 41% | 狼3预女猎守 47% | 狼2预女 51% | 狼3预女猎 48% |
| choose|top|no|no|side|cupid | 狼3预女猎守 49% | 狼3预女猎 49% | 狼3预女 48% |
| choose|top|no|no|baby | 狼2预女猎守 33% | 狼2预女猎 51% | 狼2预女 43% | 狼2预女 48% | 狼3预女守 52% | 狼2预女 50% |
| choose|top|no|no|baby|cupid | 狼3预女猎守 46% | 狼3预女猎 53% | 狼3预女 57% |
| choose|top|no|no|city | 狼2预女猎 52% | 狼2预女守 76% | 狼3预女猎守 39% | 狼3预女 57% | 狼4预女猎守 33% | 狼4预女猎守 53% |
| choose|top|no|no|city|cupid | 狼3预女 50% | 狼3预女 65% | 狼4预女守 49% |
| choose|top|no|yes|side | 狼2预女猎守 34% | 狼2预女猎 47% | 狼2预女猎 58% | 狼2预女 46% | 狼2预女 49% | 狼2预女 51% |
| choose|top|no|yes|side|cupid | 狼3预女猎守 44% | 狼3预女猎 46% | 狼3预女 50% |
| choose|top|no|yes|baby | 狼2预女 23% | 狼2预女猎 49% | 狼2预女 43% | 狼2预女 45% | 狼3预女守 50% | 狼2预女 51% |
| choose|top|no|yes|baby|cupid | 狼3预女守 43% | 狼3预女猎 49% | 狼3预女猎 60% |
| choose|top|no|yes|city | 狼2预女猎守 40% | 狼2预女 64% | 狼3预女猎守 26% | 狼3预女 45% | 狼3预女 66% | 狼4预女猎守 48% |
| choose|top|no|yes|city|cupid | 狼3预女猎守 49% | 狼3预女猎 63% | 狼4预女猎守 45% |
| choose|top|maybe|no|side | 狼2预女猎守 48% | 狼2预女猎 54% | 狼2预女 42% | 狼3预女猎守 51% | 狼3预女守 51% | 狼3预女猎 47% |
| choose|top|maybe|no|side|cupid | 狼3预女猎守 50% | 狼3预女猎 51% | 狼3预女 52% |
| choose|top|maybe|no|baby | 狼2预女守 39% | 狼2预女猎 55% | 狼2预女 45% | 狼3预女猎守 48% | 狼2预女 49% | 狼3预女猎 51% |
| choose|top|maybe|no|baby|cupid | 狼3预女守 49% | 狼3预女 50% | 狼4预女守 41% |
| choose|top|maybe|no|city | 狼2预女 51% | 狼2预女猎 74% | 狼3预女猎守 48% | 狼3预女 61% | 狼4预女猎守 38% | 狼4预女猎 50% |
| choose|top|maybe|no|city|cupid | 狼3预女猎 57% | 狼4预女猎守 37% | 狼4预女猎 51% |
| choose|top|maybe|yes|side | 狼2预女猎守 38% | 狼2预女猎 47% | 狼2预女猎 60% | 狼3预女猎守 46% | 狼3预女守 50% | 狼2预女 51% |
| choose|top|maybe|yes|side|cupid | 狼3预女猎守 46% | 狼3预女猎 48% | 狼3预女 51% |
| choose|top|maybe|yes|baby | 狼2预女守 32% | 狼2预女猎 50% | 狼2预女 44% | 狼3预女猎守 48% | 狼3预女守 51% | 狼3预女猎 49% |
| choose|top|maybe|yes|baby|cupid | 狼3预女守 44% | 狼3预女猎 51% | 狼3预女 55% |
| choose|top|maybe|yes|city | 狼2预女守 39% | 狼2预女 65% | 狼3预女猎守 36% | 狼3预女 51% | 狼4预女守 32% | 狼4预女猎守 53% |
| choose|top|maybe|yes|city|cupid | 狼3预女猎 49% | 狼3预女猎 63% | 狼4预女猎守 47% |
| choose|top|force|no|side | 狼3预女猎守 27% | 狼3预女猎守 42% | 狼3预女猎守 53% | 狼3预女守 52% | 狼3预女猎 50% | 狼4预女猎守 44% |
| choose|top|force|no|side|cupid | 狼3预女猎 53% | 狼3预女 51% | 狼4预女猎守 48% |
| choose|top|force|no|baby | 狼3预女守 20% | 狼3预女猎守 39% | 狼3预女猎守 50% | 狼3预女守 56% | 狼3预女猎 53% | 狼4预女猎守 47% |
| choose|top|force|no|baby|cupid | 狼3预女 55% | 狼3预女 59% | 狼4预女守 48% |
| choose|top|force|no|city | 狼3预女守 30% | 狼3预女猎 53% | 狼3预女猎 66% | 狼4预女猎守 40% | 狼4预女猎 53% | 狼4预女 64% |
| choose|top|force|no|city|cupid | 狼4预女猎守 38% | 狼4预女猎守 50% | 狼4预女 58% |
| choose|top|force|yes|side | 狼3预女猎守 19% | 狼3预女守 35% | 狼3预女猎守 50% | 狼3预女守 51% | 狼3预女猎 52% | 狼3预女猎 55% |
| choose|top|force|yes|side|cupid | 狼3预女猎 52% | 狼3预女 49% | 狼3预女 53% |
| choose|top|force|yes|baby | 狼3预女守 12% | 狼3预女守 34% | 狼3预女猎守 49% | 狼3预女猎 48% | 狼3预女猎 53% | 狼4预女猎守 44% |
| choose|top|force|yes|baby|cupid | 狼3预女猎 52% | 狼3预女 58% | 狼4预女猎守 48% |
| choose|top|force|yes|city | 狼3预女猎守 22% | 狼3预女猎 41% | 狼3预女 58% | 狼4预女猎守 32% | 狼4预女猎守 49% | 狼4预女 59% |
| choose|top|force|yes|city|cupid | 狼3预女 63% | 狼4预女猎守 48% | 狼4预女 55% |
| choose|all|no|no|side | 狼1预女猎守 51% | 狼1预女猎 47% | 狼1预女猎 51% | 狼1预女猎 54% | 狼1预女猎 59% | 狼1预女 45% |
| choose|all|no|no|side|cupid | 狼1预女 60% | 狼2预女猎守 36% | 狼2预女猎守 41% |
| choose|all|no|no|baby | 狼1预女守 49% | 狼1预女猎 51% | 狼1预女猎 56% | 狼1预女猎 58% | 狼1预女 43% | 狼1预女 42% |
| choose|all|no|no|baby|cupid | 狼1预女猎 69% | 狼2预女猎守 38% | 狼2预女猎守 47% |
| choose|all|no|no|city | 狼1预女 57% | 狼1预女猎守 65% | 狼2预女守 30% | 狼2预女守 40% | 狼2预女猎守 50% | 狼2预女猎守 55% |
| choose|all|no|no|city|cupid | 狼2预女猎 37% | 狼2预女猎守 49% | 狼2预女猎 56% |
| choose|all|no|yes|side | 狼1预女猎守 49% | 狼1预女猎 45% | 狼1预女猎 50% | 狼1预女猎 57% | 狼1预女猎 59% | 狼1预女 42% |
| choose|all|no|yes|side|cupid | 狼1预女 58% | 狼2预女猎守 38% | 狼2预女猎守 41% |
| choose|all|no|yes|baby | 狼1预女守 48% | 狼1预女猎守 57% | 狼1预女猎 56% | 狼1预女猎 56% | 狼1预女 42% | 狼1预女 44% |
| choose|all|no|yes|baby|cupid | 狼1预女猎 70% | 狼2预女猎守 36% | 狼2预女猎守 44% |
| choose|all|no|yes|city | 狼1预女猎 55% | 狼1预女猎守 65% | 狼1预女 69% | 狼2预女猎 35% | 狼2预女守 47% | 狼2预女守 54% |
| choose|all|no|yes|city|cupid | 狼2预女守 36% | 狼2预女猎守 46% | 狼2预女猎守 53% |
| choose|all|maybe|no|side | 狼1预女猎守 51% | 狼1预女守 52% | 狼1预女猎 52% | 狼1预女猎 55% | 狼1预女猎 59% | 狼1预女 45% |
| choose|all|maybe|no|side|cupid | 狼1预女 60% | 狼2预女猎守 40% | 狼2预女猎守 43% |
| choose|all|maybe|no|baby | 狼1预女守 47% | 狼1预女守 53% | 狼1预女猎 55% | 狼1预女猎 57% | 狼1预女 42% | 狼2预女猎守 42% |
| choose|all|maybe|no|baby|cupid | 狼2预女守 36% | 狼2预女守 42% | 狼2预女猎守 47% |
| choose|all|maybe|no|city | 狼1预女 57% | 狼1预女 68% | 狼2预女猎守 36% | 狼2预女猎守 44% | 狼2预女 50% | 狼2预女猎守 55% |
| choose|all|maybe|no|city|cupid | 狼2预女猎守 45% | 狼2预女猎守 51% | 狼2预女 57% |
| choose|all|maybe|yes|side | 狼1预女守 46% | 狼1预女守 52% | 狼1预女猎 49% | 狼1预女猎 54% | 狼1预女猎 59% | 狼1预女 42% |
| choose|all|maybe|yes|side|cupid | 狼1预女 58% | 狼1预女 63% | 狼2预女猎守 45% |
| choose|all|maybe|yes|baby | 狼1预女守 49% | 狼1预女猎 49% | 狼1预女猎 54% | 狼1预女 40% | 狼1预女 43% | 狼1预女 42% |
| choose|all|maybe|yes|baby|cupid | 狼2预女守 34% | 狼2预女猎守 41% | 狼2预女猎守 46% |
| choose|all|maybe|yes|city | 狼1预女 50% | 狼1预女猎 62% | 狼1预女猎 73% | 狼2预女猎守 42% | 狼2预女猎守 49% | 狼2预女 57% |
| choose|all|maybe|yes|city|cupid | 狼2预女猎守 40% | 狼2预女猎守 50% | 狼2预女守 55% |
| choose|all|force|no|side | 狼3预女猎守 10% | 狼3预女猎守 21% | 狼3预女猎守 30% | 狼3预女猎守 33% | 狼3预女猎守 39% | 狼3预女猎守 45% |
| choose|all|force|no|side|cupid | 狼3预女猎守 37% | 狼3预女猎守 42% | 狼3预女猎守 48% |
| choose|all|force|no|baby | 狼3预女守 6% | 狼3预女守 19% | 狼3预女猎守 27% | 狼3预女猎守 35% | 狼3预女猎守 41% | 狼3预女猎守 47% |
| choose|all|force|no|baby|cupid | 狼3预女守 36% | 狼3预女守 45% | 狼3预女猎守 49% |
| choose|all|force|no|city | 狼3预女守 12% | 狼3预女猎守 26% | 狼3预女守 40% | 狼3预女猎 51% | 狼3预女猎 58% | 狼3预女 68% |
| choose|all|force|no|city|cupid | 狼3预女猎守 49% | 狼3预女猎守 57% | 狼3预女 64% |
| choose|all|force|yes|side | 狼3预女守 6% | 狼3预女猎守 17% | 狼3预女猎守 25% | 狼3预女猎守 32% | 狼3预女猎守 38% | 狼3预女猎守 45% |
| choose|all|force|yes|side|cupid | 狼3预女猎守 34% | 狼3预女猎守 42% | 狼3预女猎守 46% |
| choose|all|force|yes|baby | 狼3预女守 4% | 狼3预女守 18% | 狼3预女猎守 27% | 狼3预女猎守 34% | 狼3预女猎守 41% | 狼3预女猎守 45% |
| choose|all|force|yes|baby|cupid | 狼3预女猎守 32% | 狼3预女守 41% | 狼3预女猎守 50% |
| choose|all|force|yes|city | 狼3预女猎守 7% | 狼3预女猎守 22% | 狼3预女猎 33% | 狼3预女猎守 44% | 狼3预女猎守 57% | 狼3预女猎守 62% |
| choose|all|force|yes|city|cupid | 狼3预女猎守 43% | 狼3预女猎 52% | 狼3预女猎守 62% |
| random|top|no|no|side | 狼1预女 65% | 狼2预女猎守 37% | 狼2预女猎守 50% | 狼2预女守 54% | 狼2预女猎 55% | 狼2预女 48% |
| random|top|no|no|side|cupid | 狼2预女猎 54% | 狼2预女 54% | 狼2预女 65% |
| random|top|no|no|baby | 狼1预女 64% | 狼1预女 69% | 狼2预女猎守 48% | 狼2预女猎 49% | 狼2预女猎 55% | 狼2预女 46% |
| random|top|no|no|baby|cupid | 狼2预女 55% | 狼2预女 60% | 狼3预女猎守 43% |
| random|top|no|no|city | 狼2预女猎守 27% | 狼2预女猎守 43% | 狼2预女 58% | 狼2预女猎 70% | 狼3预女猎守 42% | 狼3预女猎守 55% |
| random|top|no|no|city|cupid | 狼2预女猎 67% | 狼3预女猎守 42% | 狼3预女 49% |
| random|top|no|yes|side | 狼1预女 58% | 狼2预女猎守 30% | 狼2预女猎守 46% | 狼2预女守 53% | 狼2预女猎 56% | 狼2预女 48% |
| random|top|no|yes|side|cupid | 狼2预女猎 52% | 狼2预女 54% | 狼3预女猎守 37% |
| random|top|no|yes|baby | 狼1预女 62% | 狼1预女 71% | 狼2预女猎守 43% | 狼2预女守 50% | 狼2预女猎 55% | 狼2预女 45% |
| random|top|no|yes|baby|cupid | 狼2预女猎 52% | 狼2预女 60% | 狼3预女守 41% |
| random|top|no|yes|city | 狼1预女 76% | 狼2预女猎守 38% | 狼2预女 52% | 狼2预女 66% | 狼3预女猎守 36% | 狼3预女猎守 50% |
| random|top|no|yes|city|cupid | 狼2预女 60% | 狼3预女猎守 34% | 狼3预女守 50% |
| random|top|maybe|no|side | 狼1预女 63% | 狼2预女猎守 39% | 狼2预女猎守 52% | 狼2预女猎 52% | 狼2预女 45% | 狼2预女 49% |
| random|top|maybe|no|side|cupid | 狼2预女 52% | 狼2预女 57% | 狼3预女猎守 46% |
| random|top|maybe|no|baby | 狼1预女 65% | 狼2预女猎 31% | 狼2预女猎守 49% | 狼2预女猎 52% | 狼2预女猎 59% | 狼2预女 47% |
| random|top|maybe|no|baby|cupid | 狼2预女 55% | 狼2预女猎守 70% | 狼3预女猎守 46% |
| random|top|maybe|no|city | 狼2预女猎守 34% | 狼2预女猎守 50% | 狼2预女 61% | 狼3预女守 32% | 狼3预女猎守 47% | 狼3预女猎守 60% |
| random|top|maybe|no|city|cupid | 狼3预女猎守 35% | 狼3预女猎守 48% | 狼3预女 53% |
| random|top|maybe|yes|side | 狼1预女 57% | 狼1预女 66% | 狼2预女猎守 50% | 狼2预女猎 49% | 狼2预女 45% | 狼2预女 51% |
| random|top|maybe|yes|side|cupid | 狼2预女猎 53% | 狼2预女 58% | 狼3预女猎守 45% |
| random|top|maybe|yes|baby | 狼1预女 61% | 狼2预女猎守 31% | 狼2预女守 45% | 狼2预女猎 48% | 狼2预女 48% | 狼2预女 46% |
| random|top|maybe|yes|baby|cupid | 狼2预女 53% | 狼2预女 62% | 狼3预女猎守 42% |
| random|top|maybe|yes|city | 狼1预女守 79% | 狼2预女猎守 39% | 狼2预女 52% | 狼2预女猎 68% | 狼3预女猎守 41% | 狼3预女 51% |
| random|top|maybe|yes|city|cupid | 狼2预女 63% | 狼3预女猎 36% | 狼3预女猎 49% |
| random|top|force|no|side | 狼3预女猎守 14% | 狼3预女猎守 26% | 狼3预女猎守 35% | 狼3预女猎守 48% | 狼3预女猎守 54% | 狼3预女猎 51% |
| random|top|force|no|side|cupid | 狼3预女猎守 45% | 狼3预女守 50% | 狼3预女 47% |
| random|top|force|no|baby | 狼3预女猎守 13% | 狼3预女猎守 22% | 狼3预女猎守 32% | 狼3预女猎守 47% | 狼3预女猎 48% | 狼3预女猎 53% |
| random|top|force|no|baby|cupid | 狼3预女猎守 42% | 狼3预女猎 51% | 狼3预女 57% |
| random|top|force|no|city | 狼3预女猎守 19% | 狼3预女猎守 32% | 狼3预女猎守 46% | 狼3预女猎守 59% | 狼3预女猎守 68% | 狼4预女猎守 43% |
| random|top|force|no|city|cupid | 狼3预女 48% | 狼3预女 61% | 狼4预女猎 38% |
| random|top|force|yes|side | 狼3预女守 6% | 狼3预女猎守 22% | 狼3预女猎守 34% | 狼3预女猎守 45% | 狼3预女猎守 54% | 狼3预女猎 52% |
| random|top|force|yes|side|cupid | 狼3预女猎守 43% | 狼3预女猎守 51% | 狼3预女 47% |
| random|top|force|yes|baby | 狼3预女猎守 6% | 狼3预女猎守 19% | 狼3预女守 30% | 狼3预女猎守 44% | 狼3预女猎守 55% | 狼3预女猎 53% |
| random|top|force|yes|baby|cupid | 狼3预女猎守 41% | 狼3预女守 51% | 狼3预女 56% |
| random|top|force|yes|city | 狼3预女猎守 9% | 狼3预女猎守 28% | 狼3预女猎守 41% | 狼3预女 48% | 狼3预女猎 64% | 狼4预女猎守 39% |
| random|top|force|yes|city|cupid | 狼3预女猎守 51% | 狼3预女 55% | 狼4预女猎守 35% |
| random|all|no|no|side | 狼1预女 56% | 狼1预女 59% | 狼2预女猎守 40% | 狼2预女猎守 53% | 狼2预女守 53% | 狼2预女猎 55% |
| random|all|no|no|side|cupid | 狼2预女猎守 52% | 狼2预女猎 53% | 狼2预女 54% |
| random|all|no|no|baby | 狼1预女 57% | 狼1预女 66% | 狼2预女猎守 40% | 狼2预女猎守 49% | 狼2预女守 54% | 狼2预女猎 58% |
| random|all|no|no|baby|cupid | 狼2预女守 51% | 狼2预女 57% | 狼2预女 59% |
| random|all|no|no|city | 狼1预女守 70% | 狼2预女猎守 34% | 狼2预女猎守 49% | 狼2预女 56% | 狼2预女 66% | 狼3预女猎守 43% |
| random|all|no|no|city|cupid | 狼2预女 55% | 狼2预女 65% | 狼3预女猎守 43% |
| random|all|no|yes|side | 狼1预女 49% | 狼1预女 57% | 狼2预女猎守 36% | 狼2预女猎守 46% | 狼2预女守 51% | 狼2预女猎 55% |
| random|all|no|yes|side|cupid | 狼2预女猎守 48% | 狼2预女 45% | 狼2预女 53% |
| random|all|no|yes|baby | 狼1预女猎 57% | 狼1预女 61% | 狼2预女猎守 35% | 狼2预女猎守 48% | 狼2预女猎 48% | 狼2预女猎 54% |
| random|all|no|yes|baby|cupid | 狼2预女猎守 46% | 狼2预女猎 54% | 狼2预女 58% |
| random|all|no|yes|city | 狼1预女 61% | 狼2预女猎守 29% | 狼2预女猎守 46% | 狼2预女 52% | 狼2预女猎 63% | 狼3预女守 41% |
| random|all|no|yes|city|cupid | 狼2预女猎守 54% | 狼2预女守 61% | 狼3预女猎守 39% |
| random|all|maybe|no|side | 狼1预女 54% | 狼1预女 57% | 狼2预女守 38% | 狼2预女守 48% | 狼2预女守 55% | 狼2预女 47% |
| random|all|maybe|no|side|cupid | 狼2预女守 50% | 狼2预女猎 55% | 狼2预女 53% |
| random|all|maybe|no|baby | 狼1预女守 61% | 狼1预女猎 70% | 狼2预女猎守 41% | 狼2预女守 48% | 狼2预女猎 52% | 狼2预女猎 57% |
| random|all|maybe|no|baby|cupid | 狼2预女猎 50% | 狼2预女 56% | 狼3预女守 41% |
| random|all|maybe|no|city | 狼1预女守 71% | 狼2预女猎守 38% | 狼2预女守 49% | 狼2预女 58% | 狼3预女猎守 38% | 狼3预女 44% |
| random|all|maybe|no|city|cupid | 狼2预女猎 57% | 狼3预女猎 36% | 狼3预女猎守 49% |
| random|all|maybe|yes|side | 狼1预女 51% | 狼1预女 59% | 狼1预女 65% | 狼2预女猎守 49% | 狼2预女守 52% | 狼2预女猎 57% |
| random|all|maybe|yes|side|cupid | 狼2预女猎守 52% | 狼2预女 46% | 狼2预女 51% |
| random|all|maybe|yes|baby | 狼1预女猎 56% | 狼1预女 64% | 狼2预女守 38% | 狼2预女守 47% | 狼2预女猎 53% | 狼2预女守 57% |
| random|all|maybe|yes|baby|cupid | 狼2预女守 47% | 狼2预女 56% | 狼3预女猎守 38% |
| random|all|maybe|yes|city | 狼1预女 65% | 狼2预女猎守 31% | 狼2预女猎守 46% | 狼2预女 53% | 狼2预女守 66% | 狼3预女守 42% |
| random|all|maybe|yes|city|cupid | 狼2预女猎守 55% | 狼2预女 62% | 狼3预女猎 39% |
| random|all|force|no|side | 狼3预女猎守 13% | 狼3预女猎守 24% | 狼3预女猎守 35% | 狼3预女猎守 46% | 狼3预女猎守 52% | 狼3预女猎 51% |
| random|all|force|no|side|cupid | 狼3预女猎守 43% | 狼3预女猎守 51% | 狼3预女猎 54% |
| random|all|force|no|baby | 狼3预女猎守 11% | 狼3预女守 20% | 狼3预女猎守 33% | 狼3预女猎守 44% | 狼3预女猎 45% | 狼3预女猎 51% |
| random|all|force|no|baby|cupid | 狼3预女猎守 42% | 狼3预女守 53% | 狼3预女 53% |
| random|all|force|no|city | 狼3预女猎守 15% | 狼3预女猎守 29% | 狼3预女守 38% | 狼3预女猎 51% | 狼3预女守 62% | 狼4预女猎守 37% |
| random|all|force|no|city|cupid | 狼3预女猎 49% | 狼3预女 56% | 狼4预女猎守 35% |
| random|all|force|yes|side | 狼3预女猎守 7% | 狼3预女猎守 21% | 狼3预女猎守 31% | 狼3预女猎守 40% | 狼3预女猎守 50% | 狼3预女守 51% |
| random|all|force|yes|side|cupid | 狼3预女猎守 39% | 狼3预女猎守 49% | 狼3预女守 52% |
| random|all|force|yes|baby | 狼3预女猎守 5% | 狼3预女猎守 18% | 狼3预女猎守 28% | 狼3预女猎守 43% | 狼3预女猎 46% | 狼3预女猎 50% |
| random|all|force|yes|baby|cupid | 狼3预女守 39% | 狼3预女猎守 49% | 狼3预女 55% |
| random|all|force|yes|city | 狼3预女猎守 9% | 狼3预女猎守 22% | 狼3预女猎守 34% | 狼3预女猎守 48% | 狼3预女 57% | 狼4预女守 30% |
| random|all|force|yes|city|cupid | 狼3预女守 42% | 狼3预女猎 54% | 狼3预女猎 64% |
