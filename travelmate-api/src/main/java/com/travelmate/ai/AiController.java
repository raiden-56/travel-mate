package com.travelmate.ai;

import com.travelmate.ai.PlanDtos.ApplyRequest;
import com.travelmate.ai.PlanDtos.EngineInfo;
import com.travelmate.ai.PlanDtos.ModifyRequest;
import com.travelmate.ai.PlanDtos.PlanProposal;
import com.travelmate.ai.PlanDtos.PlanRequest;
import com.travelmate.auth.CurrentUser;
import com.travelmate.trips.TripDtos.TripDto;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ai")
@Tag(name = "AI trip planner")
public class AiController {

    private final PlannerService planner;

    public AiController(PlannerService planner) {
        this.planner = planner;
    }

    public record AiStatus(String engine, String label, String model, boolean simulated) {}

    @GetMapping("/status")
    public AiStatus status() {
        EngineInfo info = planner.status();
        return new AiStatus(info.id(), info.label(), info.model(), info.simulated());
    }

    @PostMapping("/trip-planner/generate")
    public PlanProposal generate(@Valid @RequestBody PlanRequest req) {
        return planner.generate(CurrentUser.id(), req);
    }

    @PostMapping("/trip-planner/modify")
    public PlanProposal modify(@Valid @RequestBody ModifyRequest req) {
        return planner.modify(CurrentUser.id(), req.tripId(), req.instruction());
    }

    @PostMapping("/trip-planner/proposals/{proposalId}/apply")
    public TripDto apply(@PathVariable UUID proposalId, @Valid @RequestBody ApplyRequest req) {
        return planner.apply(CurrentUser.id(), proposalId, req);
    }
}
