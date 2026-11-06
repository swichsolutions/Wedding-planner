namespace WeddingPlanner.Api.Planning;

/// <summary>
/// The starter task list every new plan gets (design-system/PROPOSALS.md P8, approved 2026-10-21):
/// stage, title in Georgian and English, and where the task opens. Plural, as the couple plans
/// together. Mirrored for display by the frontend's core/task-stages.ts (stage labels and links).
/// </summary>
public static class StarterTasks
{
    /// <summary>The stages in order (how far before the wedding; "after" = after it).</summary>
    public static readonly string[] Stages = { "m12", "m10", "m8", "m6", "m4", "m2", "m1", "w1", "after" };

    /// <summary>
    /// Link: where the task opens — budget, guests, settings, invitation, day, seating, services,
    /// or catalog:&lt;category slug&gt;; null for tasks done outside the site.
    /// </summary>
    public record Task(string Stage, string Ka, string En, string? Link);

    public const string SetBudget = "განსაზღვრეთ საერთო ბიუჯეტი";
    public const string ChooseDate = "აირჩიეთ თარიღი ან თარიღების ვარიანტები";

    private static readonly Lazy<Dictionary<string, Task>> ByTitle = new(() =>
    {
        var map = new Dictionary<string, Task>();
        foreach (var t in All)
        {
            map[t.Ka] = t;
            map[t.En] = t;
        }
        return map;
    });

    /// <summary>A starter task's wording in each language; null for a custom or edited title.</summary>
    public static string? KaOf(string title) => ByTitle.Value.TryGetValue(title, out var t) ? t.Ka : null;
    public static string? EnOf(string title) => ByTitle.Value.TryGetValue(title, out var t) ? t.En : null;

    public static readonly Task[] All =
    {
        new("m12", "განსაზღვრეთ საერთო ბიუჯეტი", "Set your overall budget", "budget"),
        new("m12", "შეადგინეთ სტუმრების სავარაუდო სია", "Draft a rough guest list", "guests"),
        new("m12", "აირჩიეთ თარიღი ან თარიღების ვარიანტები", "Pick a date, or a few options", "settings"),
        new("m12", "შეარჩიეთ და დაჯავშნეთ სივრცე", "Choose and book the venue", "catalog:darbazi"),
        new("m12", "თუ ჯვრისწერა გექნებათ, შეუთანხმდით ეკლესიასა და მღვდელს", "For a church wedding, agree it with the church and the priest", null),

        new("m10", "შეარჩიეთ ფოტოგრაფი", "Choose a photographer", "catalog:fotografi"),
        new("m10", "შეარჩიეთ ვიდეოგრაფი", "Choose a videographer", "catalog:videografi"),
        new("m10", "შეარჩიეთ თამადა ან წამყვანი", "Choose a tamada or a host", "catalog:tamada"),
        new("m10", "შეარჩიეთ ბენდი ან DJ", "Choose a band or a DJ", "catalog:musika"),

        new("m8", "შეარჩიეთ დეკორატორი", "Choose a decorator", "catalog:dekori"),
        new("m8", "შეარჩიეთ ან შეუკვეთეთ კაბა", "Choose or order the dress", "catalog:kaba"),
        new("m8", "დაგეგმეთ გასართობი პროგრამა", "Plan the entertainment", "catalog:gasartobi"),
        new("m8", "თუ ქორწილი სხვა ქალაქშია, მოძებნეთ სტუმრების განთავსება", "If the wedding is in another city, find accommodation for guests", "catalog:gantavseba"),

        new("m6", "შეარჩიეთ ფლორისტი", "Choose a florist", "catalog:floristi"),
        new("m6", "შეარჩიეთ კოსტიუმი", "Choose the suit", "catalog:kostiumi"),
        new("m6", "შეარჩიეთ ბეჭდები", "Choose the rings", "catalog:bechdebi"),
        new("m6", "შეარჩიეთ მაკიაჟისა და თმის სტილისტი", "Choose a makeup artist and a hair stylist", "catalog:makiaji"),
        new("m6", "დაგეგმეთ ტრანსპორტი და კორტეჟი", "Plan transport and the motorcade", "catalog:transporti"),

        new("m4", "შექმენით მოსაწვევი", "Create the invitation", "invitation"),
        new("m4", "შეარჩიეთ ტორტი და ტკბილეული", "Choose the cake and sweets", "catalog:torti"),
        new("m4", "გაიარეთ მენიუს დეგუსტაცია სივრცეში", "Do the menu tasting at the venue", null),
        new("m4", "დაასრულეთ სტუმრების სია", "Finish the guest list", "guests"),

        new("m2", "გააგზავნეთ მოსაწვევები", "Send the invitations", "invitation"),
        new("m2", "დაჯავშნეთ ქორწინების რეგისტრაცია", "Book the civil registration", null),
        new("m2", "შეადგინეთ ქორწილის დღის განრიგი", "Make the wedding-day schedule", "day"),
        new("m2", "გაიარეთ მაკიაჟისა და ვარცხნილობის საცდელი ვარიანტი", "Do a makeup and hair trial", null),

        new("m1", "შეაგროვეთ სტუმრების პასუხები", "Collect the guests' replies", "guests"),
        new("m1", "შეადგინეთ დასხდომის გეგმა", "Make the seating plan", "seating"),
        new("m1", "დაგეგმეთ დარჩენილი გადახდები", "Plan the remaining payments", "budget"),
        new("m1", "დაუდასტურეთ დეტალები ყველა მომწოდებელს", "Confirm the details with every vendor", "services"),

        new("w1", "შეატყობინეთ სივრცეს სტუმრების საბოლოო რაოდენობა", "Tell the venue the final guest count", null),
        new("w1", "გაუზიარეთ დღის განრიგი მომწოდებლებს", "Share the day schedule with your vendors", "day"),

        new("after", "შეაფასეთ მომწოდებლები", "Review your vendors", "services"),
        new("after", "მადლობა გადაუხადეთ სტუმრებს", "Thank your guests", null),
    };
}
