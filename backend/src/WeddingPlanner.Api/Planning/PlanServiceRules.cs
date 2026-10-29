namespace WeddingPlanner.Api.Planning;

/// <summary>The statuses of a vendor in „ჩემი მომსახურებები“ (guide §6), in order.</summary>
public static class PlanServiceRules
{
    public const string Saved = "saved";
    public const string Shortlist = "shortlist";
    public const string Chosen = "chosen";

    public static readonly string[] Statuses = { Saved, Shortlist, Chosen };
}
