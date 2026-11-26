package com.travelmate.checklist;

import com.travelmate.common.Provenance;
import com.travelmate.destinations.Attraction;
import com.travelmate.destinations.DestinationCategory;
import com.travelmate.weather.WeatherDto;
import com.travelmate.weather.WmoCodes;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Rule-based packing suggestions from the trip's destination categories, planned activities,
 * duration, trip type and (when available) the real forecast. Nothing is saved; the user picks.
 */
public final class ChecklistSuggester {

    public record Suggestion(String label, String category, String reason) {}

    public record Result(Provenance provenance, List<Suggestion> items) {}

    public record Input(Set<String> destinationCategories, Set<String> attractionCategories, Set<String> tags,
                        int dayCount, int travelers, String tripType, Optional<WeatherDto> weather) {}

    private ChecklistSuggester() {}

    public static Set<String> categorySlugs(java.util.Collection<DestinationCategory> cats) {
        Set<String> out = new java.util.HashSet<>();
        cats.forEach(c -> out.add(c.getSlug()));
        return out;
    }

    public static Set<String> attractionCategories(java.util.Collection<Attraction> as) {
        Set<String> out = new java.util.HashSet<>();
        as.forEach(a -> out.add(a.getCategory()));
        return out;
    }

    public static Result suggest(Input in, Set<String> existingLabelsLower) {
        Map<String, Suggestion> out = new LinkedHashMap<>();
        var add = new Object() {
            void add(String label, String category, String reason) {
                if (!existingLabelsLower.contains(label.toLowerCase()) && !out.containsKey(label.toLowerCase())) {
                    out.put(label.toLowerCase(), new Suggestion(label, category, reason));
                }
            }
        };

        add.add("Government photo ID", "DOCUMENTS", "Needed for hotel check-in and many tickets");
        add.add("Phone charger and power bank", "ELECTRONICS", "Maps and tickets drain the battery");
        add.add("Personal medicines", "MEDICINES", "Pharmacies can be far apart outside cities");

        Set<String> dc = in.destinationCategories();
        Set<String> ac = in.attractionCategories();
        if (dc.contains("beaches") || ac.contains("BEACH") || ac.contains("ISLAND")) {
            add.add("Sunscreen (SPF 30+)", "TOILETRIES", "Beach destination");
            add.add("Swimwear and quick-dry towel", "CLOTHING", "Beach destination");
            add.add("Hat and sunglasses", "CLOTHING", "Strong sun on the coast");
        }
        if (dc.contains("trekking") || dc.contains("mountains") || in.tags().contains("trek")) {
            add.add("Trekking shoes with good grip", "CLOTHING", "Trails or hill walks on the plan");
            add.add("Daypack", "ADVENTURE", "Treks need hands-free carrying");
            add.add("Blister plasters", "MEDICINES", "Long walks");
        }
        if (dc.contains("hill-stations") || dc.contains("mountains")) {
            add.add("Light jacket or fleece", "CLOTHING", "Hill evenings get cool");
        }
        if (dc.contains("waterfalls") || ac.contains("WATERFALL")) {
            add.add("Footwear that can get wet", "CLOTHING", "Waterfall paths are slippery");
        }
        if (dc.contains("wildlife") || ac.contains("WILDLIFE") || dc.contains("camping")) {
            add.add("Insect repellent", "TOILETRIES", "Forest areas");
            add.add("Neutral-coloured clothing", "CLOTHING", "Better for safaris");
        }
        if (in.tags().contains("scuba") || in.tags().contains("snorkeling") || in.tags().contains("rafting")) {
            add.add("Waterproof phone pouch", "ELECTRONICS", "Water activities planned");
            add.add("Medical declaration for water sports", "DOCUMENTS", "Operators often ask for it");
        }
        if (ac.contains("TEMPLE") || ac.contains("HERITAGE")) {
            add.add("Clothing that covers shoulders and knees", "CLOTHING", "Temple dress codes");
        }
        if (in.dayCount() >= 4) {
            add.add("Small laundry kit or detergent sheets", "TOILETRIES", in.dayCount() + "-day trip");
        }
        if ("ROAD_TRIP".equals(in.tripType())) {
            add.add("Driving licence and vehicle papers", "DOCUMENTS", "Road trip");
            add.add("Offline maps downloaded", "ELECTRONICS", "Patchy signal on highways");
        }
        if ("FAMILY".equals(in.tripType()) || in.travelers() >= 4) {
            add.add("Wet wipes and snacks", "FOOD", "Group or family travel");
        }

        boolean usedWeather = false;
        if (in.weather().isPresent()) {
            WeatherDto w = in.weather().get();
            usedWeather = true;
            boolean wet = w.daily().stream().anyMatch(d -> WmoCodes.isWet(d.weatherCode())
                    || (d.precipitationProbability() != null && d.precipitationProbability() >= 50));
            boolean hot = w.daily().stream().anyMatch(d -> d.maxC() >= 32);
            boolean cold = w.daily().stream().anyMatch(d -> d.minC() <= 12);
            if (wet) add.add("Umbrella or rain jacket", "CLOTHING", "Rain in the 7-day forecast (Open-Meteo)");
            if (hot) add.add("Electrolyte sachets", "MEDICINES", "Highs above 32°C in the forecast (Open-Meteo)");
            if (cold) add.add("Warm layer for nights", "CLOTHING", "Lows near or below 12°C in the forecast (Open-Meteo)");
        }

        String note = usedWeather
                ? "Rule-based suggestions from your destination, plan and the current 7-day forecast."
                : "Rule-based suggestions from your destination and plan. Forecast was not available.";
        return new Result(Provenance.approximate("checklist-rules", note), new ArrayList<>(out.values()));
    }
}
