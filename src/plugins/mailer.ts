import fp from 'fastify-plugin'
import nodemailer from 'nodemailer'

type MailSendOptions = { to: string | string[]; subject: string; text?: string; html?: string }

export default fp(
  async (app) => {
    if (!app.config.notifyEmailEnabled) {
      app.log.info('[mailer] email notifications disabled')
      app.decorate('mailer', {
        send: async (opts: MailSendOptions) => {
          void opts
          app.log.debug('[mailer] skipped (disabled)')
        },
      })
      return
    }

    const { smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass } = app.config
    if (!smtpHost || !smtpUser || !smtpPass) {
      app.log.warn('[mailer] missing smtp config, disable mailer')
      app.decorate('mailer', {
        send: async (opts: MailSendOptions) => {
          void opts
          app.log.debug('[mailer] skipped (invalid config)')
        },
      })
      return
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort ?? 465,
      secure: smtpSecure ?? true,
      auth: { user: smtpUser, pass: smtpPass },
    })

    // 启动时做一次连通性校验，便于尽早发现配置问题
    try {
      await transporter.verify()
      app.log.info('[mailer] SMTP connection verified')
    } catch (e) {
      app.log.warn({ e }, '[mailer] SMTP verify failed (will keep running)')
    }

    app.decorate('mailer', {
      send: async (opts: MailSendOptions) => {
        const to = Array.isArray(opts.to) ? opts.to.join(',') : opts.to
        await transporter.sendMail({
          from: app.config.mailFrom || smtpUser!,
          to,
          subject: opts.subject,
          text: opts.text,
          html: opts.html,
        })
      },
    })

    app.addHook('onClose', async () => {
      // no-op for nodemailer
    })
  },
  { name: 'mailer', dependencies: ['config'] }
)
