package com.travelmate.weather;

import com.travelmate.common.Provenance;

import java.util.List;

public record WeatherDto(Provenance provenance, String timezone, Current current, List<Daily> daily) {

    public record Current(String time, double temperatureC, double apparentC, double precipitationMm, double windKph,
                          int weatherCode, String description) {}

    public record Daily(String date, double minC, double maxC, Integer precipitationProbability,
                        double precipitationMm, int weatherCode, String description) {}
}
