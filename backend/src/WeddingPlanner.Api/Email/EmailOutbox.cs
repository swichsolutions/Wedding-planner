using System.Threading.Channels;
using WeddingPlanner.Infrastructure.Email;

namespace WeddingPlanner.Api.Email;

/// <summary>
/// In-memory queue for outgoing mail. A request enqueues and answers at once; the worker below
/// delivers in the background. Keeps SMTP latency out of responses — on forgot-password that
/// delay would otherwise tell a caller which emails have accounts.
/// </summary>
public class EmailOutbox
{
    private readonly Channel<EmailMessage> _channel =
        Channel.CreateBounded<EmailMessage>(new BoundedChannelOptions(500) { SingleReader = true });

    /// <summary>False when the queue is full (the mail is dropped).</summary>
    public bool TryEnqueue(EmailMessage message) => _channel.Writer.TryWrite(message);

    public ChannelReader<EmailMessage> Reader => _channel.Reader;
}

/// <summary>Drains <see cref="EmailOutbox"/> one message at a time through the configured sender.</summary>
public class EmailOutboxWorker : BackgroundService
{
    private readonly EmailOutbox _outbox;
    private readonly IEmailSender _sender;
    private readonly ILogger<EmailOutboxWorker> _logger;

    public EmailOutboxWorker(EmailOutbox outbox, IEmailSender sender, ILogger<EmailOutboxWorker> logger)
    {
        _outbox = outbox;
        _sender = sender;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var message in _outbox.Reader.ReadAllAsync(stoppingToken))
        {
            try
            {
                await _sender.SendAsync(message, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                // Subject only: the recipient is personal data, the body may hold a reset token.
                _logger.LogError(ex, "Sending email \"{Subject}\" failed.", message.Subject);
            }
        }
    }
}
