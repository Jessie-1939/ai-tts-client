# 隐私政策

本扩展（AI TTS Client）设计为**本地优先（local-first）** 的 TTS 客户端，最大程度保护你的隐私。

## 数据收集

本扩展**不主动收集任何用户数据**。包括但不限于：

- 不收集使用统计（analytics）
- 不收集错误报告（除非你主动通过 GitHub Issues 提交）
- 不收集设备指纹、浏览历史或网页内容

## 本地存储的内容

扩展使用 `chrome.storage.local` 在你自己的浏览器中存储以下信息：

- 你填写的 API Key（仅用于调用 TTS 服务）
- 你选择的音色 ID
- 本地字符统计（今日/历史，仅用于个人参考）

这些数据**不会离开你的设备**。卸载扩展或清除浏览器存储即可完全删除。

## 发送给 TTS 提供商的数据

当你使用“朗读选中文本”功能时：

- 你选中的文本内容
- 你配置的 API Key 和音色参数

会由你的浏览器**直接发送**到你所选的 TTS 提供商（当前版本为火山引擎，域名 `openspeech.bytedance.com`）。本扩展**不经过任何第三方服务器**，作者也不运行任何代理或中转服务。

## 数据不会共享给其他第三方

本扩展不会将你的任何数据出售、交换或共享给任何其他第三方，除非法律强制要求。

## 责任与计费

- 你对自己的 API Key 及账户安全负全责。
- 你自行承担 TTS 提供商产生的费用（如有）。
- 本扩展不限制你的每日使用量，也不估算费用（因为你直接使用自己的账户）。

## 用户权利

你可以随时通过以下方式删除本扩展存储的所有数据：

- 在浏览器扩展管理页面卸载本扩展
- 或者在浏览器的开发者工具（F12）→ Application → Storage → Extension Storage 中手动清除

## 政策更新

如果本隐私政策发生重大变更，我们会通过 GitHub 仓库发布更新，并在扩展的商店页面更新链接。继续使用本扩展即表示你接受更新后的政策。

## 源代码透明度

本扩展完全开源。你可以随时审查源代码，确认其不包含任何隐藏的数据收集行为。源代码地址：[https://github.com/Jessie-1939/ai-tts-client](https://github.com/Jessie-1939/ai-tts-client)


## 免责声明

- **“按原样”提供**：本扩展按“原样”（AS IS）提供，不附带任何明示或暗示的担保，包括但不限于适销性、特定用途适用性或不侵权的担保。
- **不保证无中断或无错误**：作者不保证本扩展始终可用、无中断、无错误或安全。任何由于网络、API 提供商故障、浏览器更新或其他不可控因素导致的服务中断或功能异常，作者不承担责任。
- **第三方 API 风险**：本扩展依赖第三方 TTS 提供商（当前为火山引擎）的 API 服务。该服务的可用性、稳定性、数据安全及计费政策均由该第三方独立控制。作者不对该第三方服务的任何问题（包括但不限于数据泄露、服务中断、费用争议或内容审查）承担任何责任。
- **内容合法性**：本扩展仅为技术工具，不对用户通过其生成的语音内容（包括文字来源和朗读结果）的合法性、合规性负责。用户应自行确保其使用行为符合相关法律法规及第三方 API 的条款。
- **责任上限**：在任何情况下，作者均不对因使用或无法使用本扩展而导致的任何直接、间接、偶然、特殊、惩罚性或后果性损害（包括但不限于数据丢失、商誉损失、利润损失或第三方索赔）承担责任，即使作者已被告知此类损害的可能性。
- **适用法律**：本免责声明应受项目维护者所在地法律的管辖，但不影响用户作为消费者可能享有的不可放弃的法定权利。
  
## 联系

如果你对隐私政策有任何疑问，请通过 [GitHub Issues](https://github.com/Jessie-1939/ai-tts-client/issues) 联系项目维护者。
---
*最后更新：2026 年 5 月 31 日*
# Privacy Policy

This extension, **AI TTS Client**, is designed as a **local‑first** TTS client to maximize your privacy.

## Data Collection

This extension **does not actively collect any user data**. This includes, but is not limited to:

- No usage analytics
- No error reporting (unless you voluntarily submit via GitHub Issues)
- No device fingerprinting, browsing history, or webpage content

## What We Store Locally

The extension uses `chrome.storage.local` to store the following information **on your own device**:

- Your API Key (used solely for calling the TTS service)
- Your selected voice ID
- Local character statistics (today / total, for your personal reference)

These data **never leave your device**. They are completely removed when you uninstall the extension or clear your browser storage.

## Data Sent to the TTS Provider

When you use the “Speak selected text” feature:

- The selected text
- Your configured API Key and voice parameters

are sent **directly from your browser** to the TTS provider you have chosen (currently Volcano Engine, domain `openspeech.bytedance.com`). This extension **does not pass through any third‑party servers**, and the author does not operate any proxy or relay service.

## No Sharing with Other Third Parties

This extension will not sell, exchange, or share any of your data with any other third party, unless legally required.

## Responsibility and Billing

- You are fully responsible for your own API Key and account security.
- You bear any costs incurred by the TTS provider (if applicable).
- This extension does not limit your daily usage or estimate costs – because you are using your own account directly.

## Your Rights

You may delete all data stored by this extension at any time by:

- Uninstalling the extension from your browser's extension management page
- Or manually clearing it via Developer Tools (F12) → Application → Storage → Extension Storage

## Policy Updates

If a material change is made to this privacy policy, we will publish an update in the GitHub repository and update the link on the store listing. Continued use of the extension constitutes acceptance of the updated policy.

## Source Code Transparency

This extension is fully open source. You are always free to review the source code to confirm that it contains no hidden data collection behavior. Source code URL: [GitHub repository link]

## Disclaimer

- **AS-IS**：This extension is provided “AS IS” without any warranties of any kind, either express or implied, including but not limited to merchantability, fitness for a particular purpose, or non‑infringement.
- **No guarantee of uninterrupted or error‑free service**：The author does not guarantee that the extension will be available, uninterrupted, error‑free, or secure. Any interruption or malfunction caused by network issues, API provider failures, browser updates, or other factors beyond the author’s control is not the responsibility of the author.
- **Third‑party API risks**：This extension relies on the API services of third‑party TTS providers (currently Volcano Engine). The availability, stability, data security, and billing policies of that service are solely controlled by the third party. The author assumes no responsibility for any issues arising from such third‑party services, including but not limited to data breaches, service outages, billing disputes, or content moderation.
- **Content legality**：This extension is merely a technical tool. The author is not responsible for the legality or compliance of the speech content generated by users (including the source text and the resulting audio). Users are solely responsible for ensuring their usage complies with applicable laws and the third‑party API’s terms.
- **Limitation of liability**：To the fullest extent permitted by law, in no event shall the author be liable for any direct, indirect, incidental, special, punitive, or consequential damages (including but not limited to data loss, goodwill loss, profit loss, or third‑party claims) arising out of or in connection with the use or inability to use this extension, even if the author has been advised of the possibility of such damages.
- **Governing law**：This disclaimer shall be governed by the laws of the jurisdiction where the project maintainer resides, without regard to its conflict of law provisions, and without prejudice to any mandatory consumer protections that may apply.
  
## Contact

If you have any questions about this privacy policy, please contact the project maintainer via GitHub Issues.
---
*Last updated: May 31, 2026*