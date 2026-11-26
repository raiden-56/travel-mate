package com.travelmate.profiles;

import com.travelmate.users.User;
import com.travelmate.users.UserProfile;
import com.travelmate.users.UserProfileRepository;
import com.travelmate.users.UserRepository;

import com.travelmate.auth.CurrentUser;
import com.travelmate.profiles.ProfileService.ProfileDto;
import com.travelmate.profiles.ProfileService.ProfileStats;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/profile")
@Tag(name = "Profile")
public class ProfileController {

    private final ProfileService service;

    public ProfileController(ProfileService service) {
        this.service = service;
    }

    @GetMapping
    public ProfileDto get() {
        return service.get(CurrentUser.id());
    }

    @PutMapping
    public ProfileDto update(@Valid @RequestBody ProfileDto req) {
        return service.update(CurrentUser.id(), req);
    }

    @GetMapping("/stats")
    public ProfileStats stats() {
        return service.stats(CurrentUser.id());
    }
}
