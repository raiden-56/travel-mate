package com.travelmate.ai;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Understands a fixed set of modification instructions for the offline planner. */
public final class InstructionParser {

    public record Intent(boolean cheaper, BigDecimal budgetCap, boolean relax, boolean busier, boolean adventure,
                         List<String> addCategories, List<String> removeNames, int dayDelta, boolean optimizeRoute,
                         boolean family, boolean vegetarian, String accommodation, boolean understood) {}

    private static final Map<String, String> CATEGORY_WORDS = Map.ofEntries(
            Map.entry("beach", "BEACH"), Map.entry("beaches", "BEACH"),
            Map.entry("waterfall", "WATERFALL"), Map.entry("waterfalls", "WATERFALL"), Map.entry("falls", "WATERFALL"),
            Map.entry("temple", "TEMPLE"), Map.entry("temples", "TEMPLE"),
            Map.entry("fort", "FORT"), Map.entry("forts", "FORT"),
            Map.entry("viewpoint", "VIEWPOINT"), Map.entry("viewpoints", "VIEWPOINT"),
            Map.entry("museum", "MUSEUM"), Map.entry("island", "ISLAND"),
            Map.entry("market", "MARKET"), Map.entry("wildlife", "WILDLIFE"), Map.entry("safari", "WILDLIFE"),
            Map.entry("trek", "ADVENTURE"), Map.entry("hike", "ADVENTURE"),
            Map.entry("heritage", "HERITAGE"), Map.entry("nature", "NATURE"));

    private static final Pattern ADD_CATEGORY = Pattern.compile(
            "\\b(?:add|include|more|another|visit|see)\\b(?:\\s+(?:a|an|one|more|some|another|the|a few))*\\s+(beaches|beach|waterfalls|waterfall|falls|temples|temple|forts|fort|viewpoints|viewpoint|museum|island|market|wildlife|safari|trek|hike|heritage|nature)\\b");
    private static final Pattern REMOVE = Pattern.compile("\\b(?:remove|skip|drop|delete|cancel)\\s+(?:the\\s+)?(.+?)(?:\\s+from.*)?$");
    private static final Pattern CAP = Pattern.compile(
            "\\b(?:under|below|within|less than|max(?:imum)?|keep (?:it|the (?:total|budget)) (?:under|below))\\s*(?:rs\\.?|inr|₹)?\\s*([0-9][0-9,]*(?:\\.[0-9]{1,2})?)\\s*(k)?\\b");
    private static final Pattern ACCOMMODATION = Pattern.compile(
            "\\b(?:change|switch|make)\\s+(?:the\\s+)?(?:accommodation|hotel|stay|stays)\\s+(?:to\\s+)?(?:a\\s+)?(budget|luxury|hostel|homestay|camping|mid-?range|cheaper)");

    private InstructionParser() {}

    public static Intent parse(String raw) {
        String s = raw == null ? "" : raw.toLowerCase(Locale.ROOT).trim();
        boolean understood = false;

        BigDecimal cap = null;
        Matcher m = CAP.matcher(s);
        if (m.find()) {
            try {
                cap = new BigDecimal(m.group(1).replace(",", ""));
                if (m.group(2) != null) cap = cap.multiply(BigDecimal.valueOf(1000));
                understood = true;
            } catch (NumberFormatException ignored) {
                cap = null;
            }
        }
        boolean cheaper = s.matches(".*\\b(cheap|cheaper|cheapest|budget|save money|cost less|less expensive|reduce (the )?cost|lower (the )?cost)\\b.*") || cap != null;
        boolean relax = s.matches(".*\\b(less hectic|relax|relaxed|slower|slow down|fewer|less packed|easier|easy|less rushed|not so busy)\\b.*");
        boolean busier = s.matches(".*\\b(more activities|packed|busier|fit more|more things)\\b.*");
        boolean adventure = s.matches(".*\\b(adventure|adventurous|thrill|adrenaline|adventure activities)\\b.*");
        boolean optimize = s.matches(".*\\b(optimi[sz]e|reorder|shortest|less travel|less driving|efficient route|route)\\b.*");
        boolean family = s.matches(".*\\b(family|families|kids|children|child|parents|elderly|senior|grandparents)\\b.*");
        boolean veg = s.matches(".*\\b(vegetarian|veg|vegan|jain)\\b.*");

        List<String> addCats = new ArrayList<>();
        Matcher am = ADD_CATEGORY.matcher(s);
        while (am.find()) {
            String cat = CATEGORY_WORDS.get(am.group(1));
            if (cat != null && !addCats.contains(cat)) addCats.add(cat);
        }

        List<String> remove = new ArrayList<>();
        Matcher rm = REMOVE.matcher(s);
        if (rm.find() && !s.matches(".*\\b(remove|drop|cut) (a|one) day\\b.*")) {
            String target = rm.group(1).replaceAll("[.!?]+$", "").trim();
            if (target.length() >= 3) remove.add(target);
        }

        int dayDelta = 0;
        if (s.matches(".*\\b(add (a|one|an extra|another|1) day|one more day|extra day|extend (the trip|it) by (a|one|1) day)\\b.*")) dayDelta = 1;
        if (s.matches(".*\\b((one|a|1) day (less|shorter)|reduce (the )?(number of )?days|remove (a|one) day|drop (a|one) day|cut (a|one) day|shorten)\\b.*")) dayDelta = -1;

        String accommodation = null;
        Matcher acm = ACCOMMODATION.matcher(s);
        if (acm.find()) {
            accommodation = switch (acm.group(1)) {
                case "budget", "cheaper" -> "BUDGET";
                case "luxury" -> "LUXURY";
                case "hostel" -> "HOSTEL";
                case "homestay" -> "HOMESTAY";
                case "camping" -> "CAMPING";
                default -> "MIDRANGE";
            };
        }

        understood = understood || cheaper || relax || busier || adventure || optimize || family || veg
                || !addCats.isEmpty() || !remove.isEmpty() || dayDelta != 0 || accommodation != null;
        return new Intent(cheaper, cap, relax, busier, adventure, addCats, remove, dayDelta, optimize, family, veg,
                accommodation, understood);
    }
}
