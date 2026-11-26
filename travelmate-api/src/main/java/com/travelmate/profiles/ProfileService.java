package com.travelmate.profiles;

import com.travelmate.users.User;
import com.travelmate.users.UserProfile;
import com.travelmate.users.UserProfileRepository;
import com.travelmate.users.UserRepository;

import com.travelmate.budget.Expense;
import com.travelmate.budget.ExpenseRepository;
import com.travelmate.common.ApiException;
import com.travelmate.common.Money;
import com.travelmate.common.Slugs;
import com.travelmate.favorites.FavoriteRepository;
import com.travelmate.trips.Trip;
import com.travelmate.trips.TripDtos;
import com.travelmate.trips.TripRepository;
import com.travelmate.trips.TripStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ProfileService {

    public record ProfileDto(@NotBlank @Size(min = 2, max = 60) String displayName,
                             @Size(max = 1000) String avatarUrl,
                             @Size(max = 120) String homeCity,
                             @Size(max = 1000) String bio,
                             @Size(max = 3) String preferredCurrency,
                             List<String> travelStyles) {}

    public record Spending(String currency, BigDecimal amount) {}

    public record ProfileStats(long tripsTotal, long tripsUpcoming, long tripsCompleted, long destinationsVisited,
                               long totalTravelDays, long savedPlaces, List<Spending> spending) {}

    private final UserRepository users;
    private final UserProfileRepository profiles;
    private final TripRepository trips;
    private final ExpenseRepository expenses;
    private final FavoriteRepository favorites;

    public ProfileService(UserRepository users, UserProfileRepository profiles, TripRepository trips,
                          ExpenseRepository expenses, FavoriteRepository favorites) {
        this.users = users;
        this.profiles = profiles;
        this.trips = trips;
        this.expenses = expenses;
        this.favorites = favorites;
    }

    @Transactional
    public ProfileDto get(UUID userId) {
        User user = users.findById(userId).orElseThrow(() -> ApiException.notFound("User"));
        UserProfile p = profiles.findById(userId).orElseGet(() -> profiles.save(new UserProfile(userId)));
        return toDto(user, p);
    }

    @Transactional
    public ProfileDto update(UUID userId, ProfileDto req) {
        User user = users.findById(userId).orElseThrow(() -> ApiException.notFound("User"));
        UserProfile p = profiles.findById(userId).orElseGet(() -> profiles.save(new UserProfile(userId)));
        user.setDisplayName(req.displayName().trim());
        String avatar = req.avatarUrl() == null || req.avatarUrl().isBlank() ? null : req.avatarUrl().trim();
        if (avatar != null && !avatar.startsWith("https://")) throw ApiException.badRequest("avatarUrl", "Use an https:// image URL");
        user.setAvatarUrl(avatar);
        p.setHomeCity(req.homeCity() == null || req.homeCity().isBlank() ? null : req.homeCity().trim());
        p.setBio(req.bio() == null || req.bio().isBlank() ? null : req.bio().trim());
        p.setPreferredCurrency(Money.currency(req.preferredCurrency()));
        List<String> styles = req.travelStyles() == null ? List.of() : req.travelStyles().stream()
                .map(String::toUpperCase).distinct().toList();
        for (String s : styles) if (!TripDtos.TRAVEL_STYLES.contains(s)) throw ApiException.badRequest("travelStyles", "Unknown style " + s);
        p.setTravelStyles(styles.isEmpty() ? null : String.join(",", styles));
        return toDto(user, p);
    }

    @Transactional(readOnly = true)
    public ProfileStats stats(UUID userId) {
        List<Trip> all = trips.findForMember(userId, null, false);
        all = new java.util.ArrayList<>(all);
        all.addAll(trips.findForMember(userId, null, true));
        LocalDate today = LocalDate.now();
        long upcoming = all.stream().filter(t -> TripStatus.UPCOMING.equals(t.getStatus())
                || (TripStatus.PLANNING.equals(t.getStatus()) && t.getStartDate() != null && !t.getStartDate().isBefore(today))).count();
        List<Trip> completed = all.stream().filter(t -> TripStatus.COMPLETED.equals(t.getStatus())).toList();
        long destinations = completed.stream().map(t -> t.getDestination() != null
                ? t.getDestination().getId().toString() : t.getDestinationName().toLowerCase()).distinct().count();
        long days = completed.stream().mapToLong(Trip::getDayCount).sum();
        List<UUID> ids = all.stream().map(Trip::getId).toList();
        Map<String, BigDecimal> byCurrency = new TreeMap<>();
        if (!ids.isEmpty()) {
            for (Expense e : expenses.findActiveByTrips(ids)) {
                if (Objects.equals(e.getPaidByUserId(), userId)) byCurrency.merge(e.getCurrency(), e.getAmount(), BigDecimal::add);
            }
        }
        return new ProfileStats(all.size(), upcoming, completed.size(), destinations, days, favorites.countByUserId(userId),
                byCurrency.entrySet().stream().map(en -> new Spending(en.getKey(), Money.of(en.getValue()))).collect(Collectors.toList()));
    }

    private static ProfileDto toDto(User u, UserProfile p) {
        return new ProfileDto(u.getDisplayName(), u.getAvatarUrl(), p.getHomeCity(), p.getBio(), p.getPreferredCurrency(),
                Slugs.split(p.getTravelStyles(), ","));
    }
}
