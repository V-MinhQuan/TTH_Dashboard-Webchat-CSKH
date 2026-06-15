import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import get_settings


def _safe_print(*args, **kwargs):
    """Print that handles Unicode on Windows terminals gracefully."""
    try:
        print(*args, **kwargs)
    except UnicodeEncodeError:
        text = " ".join(str(a) for a in args)
        print(text.encode("ascii", errors="replace").decode("ascii"), **kwargs)


class MailService:
    def send_otp_email(self, to_email: str, otp_code: str) -> bool:
        settings = get_settings()

        if not settings.smtp_username or not settings.smtp_password:
            _safe_print("\n" + "=" * 50)
            _safe_print("[WARN] SMTP NOT CONFIGURED! CANNOT SEND EMAIL.")
            _safe_print(f"[INFO] USER EMAIL: {to_email}")
            _safe_print(f"[INFO] GENERATED OTP CODE: {otp_code}")
            _safe_print("=" * 50 + "\n")
            return False

        sender_email = settings.smtp_sender or settings.smtp_username
        subject = "Ma xac thuc OTP doi mat khau - FLIC AI Ops"

        body_html = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #003865; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid rgba(0,56,101,0.1); border-radius: 12px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="color: #003865; margin: 0;">FLIC AI Operations Dashboard</h2>
                    <p style="font-size: 13px; color: #D73C01; font-weight: bold; margin: 5px 0 0 0;">Y\u00eau c\u1ea7u \u0111\u1ed5i m\u1eadt kh\u1ea9u</p>
                </div>
                <hr style="border: 0; border-top: 1px solid rgba(0,56,101,0.1); margin-bottom: 20px;">
                <p>Xin ch\u00e0o,</p>
                <p>H\u1ec7 th\u1ed1ng nh\u1eadn \u0111\u01b0\u1ee3c y\u00eau c\u1ea7u \u0111\u1ed5i m\u1eadt kh\u1ea9u cho t\u00e0i kho\u1ea3n c\u1ee7a b\u1ea1n. Vui l\u00f2ng s\u1eed d\u1ee5ng m\u00e3 x\u00e1c th\u1ef1c OTP d\u01b0\u1edbi \u0111\u00e2y \u0111\u1ec3 ho\u00e0n t\u1ea5t quy tr\u00ecnh:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <span style="font-size: 32px; font-weight: bold; color: #D73C01; letter-spacing: 6px; padding: 12px 24px; background-color: #FFF7E6; border: 1px dashed #D73C01; border-radius: 8px;">
                        {otp_code}
                    </span>
                </div>
                <p style="font-size: 13px; color: #64748b;">M\u00e3 OTP n\u00e0y c\u00f3 hi\u1ec7u l\u1ef1c trong v\u00f2ng <b>5 ph\u00fat</b>. N\u1ebfu kh\u00f4ng ph\u1ea3i b\u1ea1n th\u1ef1c hi\u1ec7n y\u00eau c\u1ea7u n\u00e0y, vui l\u00f2ng b\u1ecf qua email n\u00e0y ho\u1eb7c li\u00ean h\u1ec7 qu\u1ea3n tr\u1ecb vi\u00ean.</p>
                <hr style="border: 0; border-top: 1px solid rgba(0,56,101,0.1); margin-top: 20px;">
                <div style="text-align: center; font-size: 11px; color: #64748b; margin-top: 20px;">
                    &copy; 2026 FLIC Education. B\u1ea3n quy\u1ec1n \u0111\u01b0\u1ee3c b\u1ea3o l\u01b0u.
                </div>
            </body>
        </html>
        """

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = sender_email
        msg["To"] = to_email

        part_html = MIMEText(body_html, "html", "utf-8")
        msg.attach(part_html)

        try:
            _safe_print(f"[SMTP] Sending OTP {otp_code} to {to_email} via {settings.smtp_server}:{settings.smtp_port}...")
            if settings.smtp_port == 465:
                server = smtplib.SMTP_SSL(settings.smtp_server, settings.smtp_port)
            else:
                server = smtplib.SMTP(settings.smtp_server, settings.smtp_port)
                server.starttls()

            server.login(settings.smtp_username, settings.smtp_password)
            server.sendmail(sender_email, to_email, msg.as_string())
            server.quit()
            _safe_print("[SMTP] OTP email sent successfully.")
            return True
        except Exception as e:
            _safe_print("\n" + "=" * 50)
            _safe_print(f"[ERROR] SMTP SEND FAILED: {e}")
            _safe_print(f"[INFO] USER EMAIL: {to_email}")
            _safe_print(f"[INFO] GENERATED OTP CODE: {otp_code}")
            _safe_print("=" * 50 + "\n")
            return False


mail_service = MailService()
