using System.Threading.Channels;
using KHSWeb.Models;

namespace KHSWeb.Services;

public class AnalyticsQueue
{
    private readonly Channel<UnityAnalyticBatch> _queue;

    public AnalyticsQueue()
    {
        _queue = Channel.CreateUnbounded<UnityAnalyticBatch>();
    }

    public void EnqueueBatch(UnityAnalyticBatch batch)
    {
        if (batch?.events == null || batch.events.Count == 0) return;
        _queue.Writer.TryWrite(batch);
    }

    public ChannelReader<UnityAnalyticBatch> Reader => _queue.Reader;
}