namespace WeddingPlanner.Api.Email;

/// <summary>True when SMTP is configured, so mail is really delivered (else it's only logged).</summary>
public record EmailDelivery(bool Enabled);
