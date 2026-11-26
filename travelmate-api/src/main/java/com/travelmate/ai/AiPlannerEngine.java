package com.travelmate.ai;

import com.travelmate.ai.PlanDtos.EngineInfo;
import com.travelmate.ai.PlanDtos.PlanRequest;
import com.travelmate.ai.PlannerModel.Context;
import com.travelmate.ai.PlannerModel.Draft;
import com.travelmate.ai.PlannerModel.ExistingItem;

import java.util.List;

/**
 * Port for itinerary planning. Engines must only place attractions from the supplied catalogue
 * (or clearly-labelled generic blocks such as meals), must mark all costs as estimates, and in
 * {@link #modify} must keep every protected item (locked, booked or completed).
 */
public interface AiPlannerEngine {

    EngineInfo info();

    Draft generate(PlanRequest request, Context context);

    Draft modify(String instruction, PlanRequest baseline, Context context, List<ExistingItem> current);
}
