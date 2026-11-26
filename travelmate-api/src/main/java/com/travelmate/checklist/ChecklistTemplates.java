package com.travelmate.checklist;

import java.util.List;
import java.util.Optional;

/** Built-in packing templates. Defined in code for Phase 1; admin-managed templates can follow. */
public final class ChecklistTemplates {

    public record TemplateItem(String label, String category) {}

    public record Template(String key, String name, String description, List<TemplateItem> items) {}

    private static TemplateItem i(String label, String category) {
        return new TemplateItem(label, category);
    }

    private static final List<TemplateItem> CORE = List.of(
            i("Government photo ID", "DOCUMENTS"),
            i("Booking confirmations (offline copy)", "DOCUMENTS"),
            i("Phone charger", "ELECTRONICS"),
            i("Power bank", "ELECTRONICS"),
            i("Toothbrush and toothpaste", "TOILETRIES"),
            i("Personal medicines", "MEDICINES"),
            i("Basic first-aid kit", "MEDICINES"),
            i("Reusable water bottle", "ESSENTIALS"),
            i("Some cash in small notes", "ESSENTIALS"));

    public static final List<Template> ALL = List.of(
            new Template("weekend", "Weekend trip", "Light packing for two or three days.", concat(CORE, List.of(
                    i("Two changes of clothes", "CLOTHING"),
                    i("Comfortable walking shoes", "CLOTHING"),
                    i("Sunglasses", "ESSENTIALS")))),
            new Template("beach", "Beach vacation", "Sun, sand and water.", concat(CORE, List.of(
                    i("Swimwear", "CLOTHING"),
                    i("Quick-dry towel", "ESSENTIALS"),
                    i("Sunscreen (SPF 30+)", "TOILETRIES"),
                    i("Hat and sunglasses", "CLOTHING"),
                    i("Flip-flops or sandals", "CLOTHING"),
                    i("Waterproof phone pouch", "ELECTRONICS"),
                    i("After-sun or aloe gel", "TOILETRIES")))),
            new Template("trekking", "Trekking", "Day hikes and multi-day treks.", concat(CORE, List.of(
                    i("Trekking shoes with good grip", "CLOTHING"),
                    i("Moisture-wicking layers", "CLOTHING"),
                    i("Rain jacket or poncho", "CLOTHING"),
                    i("Daypack", "ADVENTURE"),
                    i("Headlamp with spare batteries", "ADVENTURE"),
                    i("Energy snacks", "FOOD"),
                    i("Blister plasters", "MEDICINES"),
                    i("Leech socks (monsoon)", "ADVENTURE")))),
            new Template("camping", "Camping", "Nights outdoors.", concat(CORE, List.of(
                    i("Tent (check with organiser)", "ADVENTURE"),
                    i("Sleeping bag", "ADVENTURE"),
                    i("Warm layer for the night", "CLOTHING"),
                    i("Headlamp", "ADVENTURE"),
                    i("Insect repellent", "TOILETRIES"),
                    i("Trash bags to carry waste out", "ESSENTIALS")))),
            new Template("international", "International trip", "Crossing borders.", concat(CORE, List.of(
                    i("Passport (valid 6+ months)", "DOCUMENTS"),
                    i("Visa or e-visa printout", "DOCUMENTS"),
                    i("Travel insurance details", "DOCUMENTS"),
                    i("Universal power adapter", "ELECTRONICS"),
                    i("Forex card or international debit card", "ESSENTIALS"),
                    i("Copies of documents stored separately", "DOCUMENTS")))),
            new Template("road-trip", "Road trip", "Driving your own or a rented vehicle.", concat(CORE, List.of(
                    i("Driving licence", "DOCUMENTS"),
                    i("Vehicle registration and insurance papers", "DOCUMENTS"),
                    i("Car phone mount and charger", "ELECTRONICS"),
                    i("Offline maps downloaded", "ELECTRONICS"),
                    i("Snacks and water for the drive", "FOOD"),
                    i("Motion-sickness tablets", "MEDICINES")))),
            new Template("family", "Family vacation", "Travelling with children or parents.", concat(CORE, List.of(
                    i("Extra clothes for kids", "CLOTHING"),
                    i("Kids' snacks", "FOOD"),
                    i("Wet wipes", "TOILETRIES"),
                    i("Prescriptions for elders", "MEDICINES"),
                    i("Entertainment for the journey", "ESSENTIALS"),
                    i("Emergency contact card for each child", "SAFETY")))),
            new Template("business", "Business travel", "Work trips.", concat(CORE, List.of(
                    i("Laptop and charger", "ELECTRONICS"),
                    i("Formal outfit", "CLOTHING"),
                    i("Business cards", "ESSENTIALS"),
                    i("Meeting documents", "DOCUMENTS"),
                    i("Noise-cancelling headphones", "ELECTRONICS")))));

    private ChecklistTemplates() {}

    public static Optional<Template> find(String key) {
        return ALL.stream().filter(t -> t.key().equals(key)).findFirst();
    }

    private static List<TemplateItem> concat(List<TemplateItem> a, List<TemplateItem> b) {
        var out = new java.util.ArrayList<>(a);
        out.addAll(b);
        return List.copyOf(out);
    }
}
