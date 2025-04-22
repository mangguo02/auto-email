// 检查环境变量
function checkEnvironmentVariables(env) {
  const requiredVars = [
      'KEY',
      'FROM_EMAIL',
      'TO_EMAILS',
      'RESEND_API_KEY'
  ];
  const missingVars = requiredVars.filter(varName => !env[varName]);    
  if (missingVars.length > 0) {
      throw new Error(`缺少必需的环境变量: ${missingVars.join(', ')}`);
  }
}

//加载邮件配置
function loadEmailConfig(env) {
  const from_email = env.FROM_EMAIL;
  const to_emails_raw = env.TO_EMAILS;
  const subject = (env && env.SUBJECT) || "测试";
  const body = (env && env.BODY) || "这是一封自动化测试邮件";

  if (!from_email || !to_emails_raw || !subject || !body) {
      throw new Error("邮件配置缺失，请检查环境变量设置。");
  }

  const to_emails = to_emails_raw
      .split(/[\n,]+/)
      .map(email => email.trim())
      .filter(email => email.length > 0);

  if (to_emails.length === 0) {
      throw new Error("收件人列表为空，请检查 TO_EMAILS 配置。");
  }

  return { from_email, to_emails, subject, body };
}

// 延迟函数
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 发送邮件函数，使用 resend API
async function sendEmail(to_email, subject, body, resendApiKey, from_email) {
  const url = "https://api.resend.com/emails";
  const payload = {
      from: from_email,
      to: [to_email],
      subject: subject,
      html: body,
  };

  const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendApiKey}`,
  };

  const response = await fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload),
  });

  if (response.ok) {
      console.log(`邮件已成功发送到 ${to_email}`);
      return true;
  } else {
      const errorText = await response.text();
      console.error(`发送邮件到 ${to_email} 失败: ${response.status} - ${errorText}`);
      throw new Error(`发送邮件失败: ${errorText}`);
  }
}

// TG消息发送函数
async function sendTelegramMessage(env, message) {
  const tgToken = env.TG_TOKEN;
  const tgId = env.TG_ID;

  const url = `https://api.telegram.org/bot${tgToken}/sendMessage`;
  const payload = {
      chat_id: tgId,
      text: message,
      parse_mode: "Markdown",
  };

  const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
  });

  if (!response.ok) {
      const errorText = await response.text();
      console.error(`Telegram 消息发送失败: ${response.status} - ${errorText}`);
      throw new Error(`Telegram 消息发送失败: ${errorText}`);
  }
}

// 渲染前端 HTML 页面
function renderHTML(lastExecution) {
  const lastExecutionData = lastExecution ? JSON.parse(lastExecution) : null;
  const lastExecutionHTML = lastExecutionData
  ? `
    <div class="card">
      <h3>上次执行结果</h3>
      <div class="stats">
        <div class="stat-item">
          <span class="label">发件人邮箱</span>
          <span class="value">${lastExecutionData.from_email}</span>
        </div>
        <div class="stat-item">
          <span class="label">收件人数量</span>
          <span class="value">${lastExecutionData.totalCount}</span>
        </div>
        <div class="stat-item">
          <span class="label">发送成功</span>
          <span class="value success">${lastExecutionData.successEmails.length}</span>
        </div>
        <div class="stat-item">
          <span class="label">发送失败</span>
          <span class="value error">${Object.keys(lastExecutionData.failedReasons).length}</span>
        </div>
      </div>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>收件邮箱</th>
              <th>状态</th>
              <th>消息</th>
              <th>执行时间</th>
            </tr>
          </thead>
          <tbody>
            ${lastExecutionData.successEmails
              .map(
                email => `
                  <tr>
                    <td>${email}</td>
                    <td><span class="badge success">✅</span></td>
                    <td>发送成功</td>
                    <td>${lastExecutionData.executionTime}</td>
                  </tr>
                `
              )
              .join("")}
            ${Object.entries(lastExecutionData.failedReasons)
              .map(
                ([email, reason]) => `
                  <tr>
                    <td>${email}</td>
                    <td><span class="badge error">❌</span></td>
                    <td>${reason}</td>
                    <td>${lastExecutionData.executionTime}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `
  : '<div class="card"><p class="no-data">暂无执行记录</p></div>';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>邮件群发工具</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          :root {
            --primary-color: #4CAF50;
            --error-color: #f44336;
            --text-color: #333;
            --border-color: #ddd;
            --bg-color: #f5f5f5;
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            color: var(--text-color);
            background: var(--bg-color);
            padding: 20px;
          }
          .container {
            max-width: 1200px;
            margin: 0 auto;
          }
          .card {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            padding: 20px;
            margin-bottom: 20px;
          }
          h1, h3 {
            color: var(--text-color);
            margin-bottom: 20px;
          }
          .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
          }
          .stat-item {
            padding: 15px;
            border-radius: 8px;
            background: #f8f9fa;
          }
          .stat-item .label {
            font-size: 14px;
            color: #666;
            display: block;
          }
          .stat-item .value {
            font-size: 20px;
            font-weight: bold;
            margin-top: 5px;
            display: block;
          }
          .value.success { color: var(--primary-color); }
          .value.error { color: var(--error-color); }
          .table-container {
            overflow-x: auto;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid var(--border-color);
          }
          th {
            background: #f8f9fa;
            font-weight: 600;
          }
          .badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
          }
          .badge.success {
            background: #e8f5e9;
            color: var(--primary-color);
          }
          .badge.error {
            background: #ffebee;
            color: var(--error-color);
          }
          button {
            background: var(--primary-color);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            transition: background 0.3s;
          }
          button:hover {
            background: #43a047;
          }
          button:disabled {
            background: #ccc;
            cursor: not-allowed;
          }
          #status {
            margin: 20px 0;
          }
          #status p {
            padding: 8px;
            margin: 4px 0;
            border-radius: 4px;
            background: #f8f9fa;
          }
          .button-status-container {
            display: flex;
            align-items: center;
            gap: 15px;
          }
          #currentStatus {
            margin: 0;
            padding: 12px 20px;
            background: #f8f9fa;
            border-radius: 4px;
            font-family: monospace;
            flex: 1;
          }
          .loading {
            display: none;
          }
          .no-data {
            text-align: center;
            color: #666;
            padding: 40px;
          }
          @media (max-width: 768px) {
            .stats {
              grid-template-columns: 1fr;
            }
            .card {
              padding: 15px;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <h1>邮件群发工具</h1>
            <div class="button-status-container">
              <button onclick="executeScript()" id="executeBtn">
                执行脚本
              </button>
              <p id="currentStatus"></p>
            </div>
            <div id="result"></div>
          </div>
          ${lastExecutionHTML}
        </div>
        <script>
          async function executeScript() {
            const button = document.getElementById('executeBtn');
            const currentStatus = document.getElementById('currentStatus');
            const resultDiv = document.getElementById('result');
            
            try {
              button.disabled = true;
              currentStatus.textContent = '准备开始发送...';
              
              const currentUrl = new URL(window.location.href);
              const key = currentUrl.searchParams.get('key');
              const postUrl = \`\${window.location.pathname}?key=\${key}\`;
              
              const response = await fetch(postUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                }
              });
              
              if (!response.ok) {
                const errorText = await response.text();
                throw new Error(\`请求失败: \${response.status} - \${errorText}\`);
              }
              
              const reader = response.body.getReader();
              const decoder = new TextDecoder();
              let buffer = '';
              
              while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\\n');
                buffer = lines.pop();
                
                for (const line of lines) {
                  try {
                    const data = JSON.parse(line);
                    
                    if (data.statusUpdates && data.statusUpdates.length > 0) {
                      currentStatus.textContent = data.statusUpdates[data.statusUpdates.length - 1];
                    }
                    
                    if (data.formData) {
                      const formData = data.formData;
                      resultDiv.innerHTML = \`
                        <h3>执行结果</h3>
                        <div class="stats">
                          <div class="stat-item">
                            <span class="label">发件人邮箱</span>
                            <span class="value">\${formData.from_email}</span>
                          </div>
                          <div class="stat-item">
                            <span class="label">收件人数量</span>
                            <span class="value">\${formData.totalCount}</span>
                          </div>
                          <div class="stat-item">
                            <span class="label">发送成功</span>
                            <span class="value success">\${formData.successEmails.length}</span>
                          </div>
                          <div class="stat-item">
                            <span class="label">发送失败</span>
                            <span class="value error">\${Object.keys(formData.failedReasons).length}</span>
                          </div>
                        </div>
                        <div class="table-container">
                          <table>
                            <thead>
                              <tr>
                                <th>收件邮箱</th>
                                <th>状态</th>
                                <th>消息</th>
                                <th>执行时间</th>
                              </tr>
                            </thead>
                            <tbody>
                              \${formData.successEmails
                                .map(email => \`
                                  <tr>
                                    <td>\${email}</td>
                                    <td><span class="badge success">✅</span></td>
                                    <td>发送成功</td>
                                    <td>\${formData.executionTime}</td>
                                  </tr>
                                \`)
                                .join('')}
                              \${Object.entries(formData.failedReasons)
                                .map(([email, reason]) => \`
                                  <tr>
                                    <td>\${email}</td>
                                    <td><span class="badge error">❌</span></td>
                                    <td>\${reason}</td>
                                    <td>\${formData.executionTime}</td>
                                  </tr>
                                \`)
                                .join('')}
                            </tbody>
                          </table>
                        </div>
                      \`;
                    }
                  } catch (e) {
                    console.error('解析响应数据出错:', e);
                  }
                }
              }
            } catch (error) {
              console.error('执行出错:', error);
              currentStatus.textContent = \`执行出错: \${error.message}\`;
            } finally {
              button.disabled = false;
            }
          }
        </script>
      </body>
    </html>
  `;
}

// 执行邮件发送任务
async function executeEmailTask(env, options = {}) {
  const { isScheduled = false, writer = null } = options;
  
  try {
      // 加载邮件配置
      const emailConfig = loadEmailConfig(env);
      const { from_email, to_emails, subject, body } = emailConfig;

      const successEmails = [];
      const failedReasons = {};
      const totalCount = to_emails.length;
      const executionTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }).replace("年", "-").replace("月", "-").replace("日", "");

      // 发送邮件
      for (let i = 0; i < totalCount; i++) {
          const email = to_emails[i];
          try {
              // 如果有 writer，发送状态更新
              if (writer) {
                  const statusUpdate = JSON.stringify({
                      statusUpdates: [`正在发送第 ${i + 1}/${totalCount} 封邮件到 ${email}`]
                  }) + '\n';
                  await writer.write(new TextEncoder().encode(statusUpdate));
              }

              // 添加延迟，确保每秒最多发送2封邮件
              if (i > 0) {
                  await delay(1000);
              }

              const result = await sendEmail(email, subject, body, env.RESEND_API_KEY, from_email);
              if (result) {
                  successEmails.push(email);
                  // 发送成功状态更新
                  if (writer) {
                      const successUpdate = JSON.stringify({
                          statusUpdates: [`总共 ${totalCount} 个邮箱发送完成！成功：${successEmails.length} 个 | 失败：${Object.keys(failedReasons).length} 个`]
                      }) + '\n';
                      await writer.write(new TextEncoder().encode(successUpdate));
                  }
              } else {
                failedReasons[email] = "未知错误";
                  // 发送失败状态更新
                  if (writer) {
                      const failureUpdate = JSON.stringify({
                          statusUpdates: [`❌ ${email} 发送失败: 未知错误`]
                      }) + '\n';
                      await writer.write(new TextEncoder().encode(failureUpdate));
                  }
              }
          } catch (error) {
            failedReasons[email] = error.message;
              // 发送错误状态更新
              if (writer) {
                  const errorUpdate = JSON.stringify({
                      statusUpdates: [`❌ ${email} 发送失败: ${error.message}`]
                  }) + '\n';
                  await writer.write(new TextEncoder().encode(errorUpdate));
              }
          }
      }

      // 构建结果数据
      const formData = {
          from_email,
          executionTime,
          totalCount,
          successEmails,
          failedReasons,
      };

      // 存储到 KV 空间
      await env.AUTO_EMAIL.put("AUTO_EMAIL", JSON.stringify(formData));

      // 发送 Telegram 消息通知
      // 获取当前时间，并转换为北京时间
      const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }).replace("年", "-").replace("月", "-").replace("日", "");
      const successCount = successEmails.length;
      const failureCount = Object.keys(failedReasons).length;

      // 构建消息
      let message = `🤖 **${isScheduled ? '自动' : '手动'}邮件群发状态报告**\n⏰ 时间: \`${now}\`\n📊 总计: \`${totalCount}\` 个邮箱\n✅ 成功: \`${successCount}\`个 | ❌ 失败: \`${failureCount}\`个\n\n`;

      // 添加成功的邮箱列表
      for (const email of successEmails) {
          message += `邮箱：\`${email}\`\n状态: ✅ 发送成功\n`;
      }

      // 添加失败的邮箱列表及原因
      for (const [email, reason] of Object.entries(failedReasons)) {
          message += `邮箱：\`${email}\`\n状态: ❌ 发送失败\n失败原因: ${reason}\n`;
      }

      // 调用 Telegram API 发送消息
      await sendTelegramMessage(env, message);

      return formData;
  } catch (error) {
      console.error("邮件任务执行失败:", error);
      // 发送错误通知到 Telegram
      await sendTelegramMessage(env, `❌ **${isScheduled ? '自动' : '手动'}邮件群发失败**\n错误信息: \`${error.message}\``);
      throw error;
  }
}

// 导出函数
export default {
  // Cron 触发器处理函数
  async scheduled(event, env, ctx) {
      console.log("Cron 触发开始执行...");
      try {
          checkEnvironmentVariables(env);
          await executeEmailTask(env, { isScheduled: true });
          console.log("Cron 任务执行完成");
      } catch (error) {
          console.error("Cron 任务执行失败:", error);
          throw error;
      }
  },

  // HTTP 请求处理函数
  async fetch(request, env, ctx) {
      try {
          checkEnvironmentVariables(env);           
          const url = new URL(request.url);
  
          // 密钥保护
          const key = url.searchParams.get("key");
          if (key !== env.KEY) {
              return new Response("访问被拒绝：密钥错误", { status: 401 });
          }
  
          // 如果是 GET 请求，返回前端网页
          if (request.method === "GET") {
              const lastExecution = await env.AUTO_EMAIL.get("AUTO_EMAIL");
              return new Response(renderHTML(lastExecution), {
                  headers: { "Content-Type": "text/html" },
              });
          }
  
          // 如果是 POST 请求，执行脚本
          if (请求.method === "POST") {
              try {
                  const encoder = new TextEncoder();
                  const stream = new TransformStream();
                  const writer = stream.writable.getWriter();
          
                  const response = new Response(stream.readable, {
                      headers: { 
                          "Content-Type": "application/json",
                          "Access-Control-Allow-Origin": "*"
                      }
                  });
          
                  // 异步处理发送邮件的过程
                  (async () => {
                      try {
                          const formData = await executeEmailTask(env, { 
                              isScheduled: false,
                              writer: writer  // 传入 writer 以支持状态更新
                          });
                          await writer.write(encoder.encode(JSON.stringify({ formData }) + '\n'));
                      } catch (error) {
                          await writer.write(
                              encoder.encode(
                                  JSON.stringify({
                                      error: true,
                                      message: error.message
                                  }) + '\n'
                              )
                          );
                      } finally {
                          await writer.close();
                      }
                  })();
          
                  return response;
              } catch (error) {
                  return new Response(JSON.stringify({
                      error: true,
                      message: error.message
                  }), {
                      status: 500,
                      headers: { 
                          "Content-Type": "application/json",
                          "Access-Control-Allow-Origin": "*"
                      }
                  });
              }
          }
  
          // 如果不是 GET 或 POST 请求，返回 405 错误
          return new Response("方法不允许", { status: 405 });
      } catch (error) {
          return new Response(error.message, { status: 500 });
      }
  }
};
