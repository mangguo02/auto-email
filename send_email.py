import os
import requests
import json
import smtplib
import traceback
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime

def load_email_config():
    """加载并验证邮件配置"""
    config_json = os.getenv('EMAIL_CONFIG')
    if not config_json:
        raise ValueError("环境变量 'EMAIL_CONFIG' 未设置或为空，请检查环境变量配置。")

    try:
        config = json.loads(config_json)
    except json.JSONDecodeError as e:
        raise ValueError(f"解析 'EMAIL_CONFIG' 时出错: {str(e)}")

    required_fields = ['smtp_server', 'smtp_port', 'smtp_user', 'smtp_pass', 'from_email', 'to_emails', 'subject', 'body']
    for field in required_fields:
        if field not in config:
            raise ValueError(f"配置中缺少必需字段: {field}")

    # 检查收件人列表
    to_emails = config['to_emails']
    if isinstance(to_emails, str):
        config['to_emails'] = [email.strip() for email in to_emails.split(",")]
    elif not isinstance(to_emails, list):
        raise ValueError("配置中的 'to_emails' 应为一个邮件地址列表或逗号分隔的字符串")
    if not config['to_emails']:
        raise ValueError("收件人列表为空，请检查 'to_emails' 配置。")

    return config

def load_telegram_config():
    """加载并验证 Telegram 配置"""
    tg_id = os.getenv('TG_ID')
    tg_token = os.getenv('TG_TOKEN')

    if tg_id and not tg_id.isdigit():
        raise ValueError("变量配置中的 'TG_ID' 应为数字，请检查配置。")
    if tg_token and ":" not in tg_token:
        raise ValueError("变量配置中的 'TG_TOKEN' 应该包含':'，请检查配置。")

    return tg_id, tg_token

def send_email(smtp_server, smtp_port, smtp_user, smtp_pass, from_email, to_email, subject, body):
    """发送邮件"""
    if smtp_port not in [465, 587]:
        raise ValueError(f"不支持的 SMTP 端口号: {smtp_port}，仅支持 465 或 587，请检查配置。")

    msg = MIMEMultipart()
    msg['From'] = from_email
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'html'))

    try:
        # 根据端口号选择加密方式
        if smtp_port == 465:
            # 使用 SMTP_SSL 直接启用 SSL
            with smtplib.SMTP_SSL(smtp_server, smtp_port) as server:
                server.login(smtp_user, smtp_pass)
                server.sendmail(from_email, to_email, msg.as_string())
        elif smtp_port == 587:
            # 使用 SMTP 和 starttls() 启用 TLS
            with smtplib.SMTP(smtp_server, smtp_port) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.sendmail(from_email, to_email, msg.as_string())

        print(f"邮件已成功发送到 {to_email}")
        return True

    except Exception as e:
        # 获取异常信息并替换敏感信息
        error_message = str(e)
        if smtp_user:
            error_message = error_message.replace(smtp_user, "[SMTP 账号错误]")
        if smtp_pass:
            error_message = error_message.replace(smtp_pass, "[SMTP 密码错误]")

        print(f"发送邮件到 {to_email} 失败: {error_message}")
        traceback.print_exc()
        return False

def send_telegram_notification(tg_id, tg_token, success_emails, failed_emails_with_reasons):
    """发送 Telegram 消息（Markdown 格式）"""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # 统计成功和失败的数量
    success_count = len(success_emails)
    failure_count = len(failed_emails_with_reasons)
    total_count = success_count + failure_count

    # 构建消息头部
    message = (
        "🤖 **邮件群发状态报告**\n"
        f"⏰ 时间: `{now}`\n"
        f"📊 总计: `{total_count}` 个邮箱\n"
        f"✅ 成功: `{success_count}`个 | ❌ 失败: `{failure_count}`个\n\n"
    )

    # 添加成功的邮箱列表
    for email in success_emails:
        message += f"邮箱：`{email}`\n状态: ✅ 发送成功\n"

    # 添加失败的邮箱列表及原因
    for email, reason in failed_emails_with_reasons.items():
        message += f"邮箱：`{email}`\n状态: ❌ 发送失败\n失败原因: {reason}\n"

   # 发送消息
    url = f"https://api.telegram.org/bot{tg_token}/sendMessage"
    payload = {
        "chat_id": tg_id,
        "text": message,
        "parse_mode": "Markdown",  # 使用 Markdown 格式
    }
    try:
        response = requests.post(url, json=payload)
        if response.status_code == 200:
            print("Telegram 通知发送成功")
        else:
            print(f"Telegram 通知发送失败: {response.status_code}, {response.text}")
    except Exception as e:
        print(f"发送 Telegram 通知时出现异常: {str(e)}")
        traceback.print_exc()  # 打印完整的异常堆栈信息

if __name__ == "__main__":
    try:
        # 加载邮件配置
        config = load_email_config()
        smtp_server = config['smtp_server']
        smtp_port = int(config['smtp_port'])
        smtp_user = config['smtp_user']
        smtp_pass = config['smtp_pass']
        from_email = config['from_email']
        to_emails = config['to_emails']
        subject = config['subject']
        body = config['body']

        # 加载 Telegram 配置
        tg_id, tg_token = load_telegram_config()
        send_telegram = bool(tg_id and tg_token)

        success_emails = []
        failed_emails_with_reasons = {}

        # 群发邮件
        for email in to_emails:
            try:
                result = send_email(smtp_server, smtp_port, smtp_user, smtp_pass, from_email, email, subject, body)
                if result:
                    success_emails.append(email)
                else:
                    failed_emails_with_reasons[email] = "未知错误"  # 如果没有具体原因，可以设置默认值
            except Exception as e:
                failed_emails_with_reasons[email] = str(e)  # 捕获具体的异常信息作为失败原因

        # 仅在 TG_ID 和 TG_TOKEN 存在时发送 Telegram 通知
        if send_telegram:
            send_telegram_notification(tg_id, tg_token, success_emails, failed_emails_with_reasons)
        else:
            print("Telegram 通知配置缺失，跳过发送 Telegram 通知。")

    except Exception as e:
        print(f"脚本运行时发生异常: {str(e)}")
        traceback.print_exc()  # 打印完整的异常堆栈信息
