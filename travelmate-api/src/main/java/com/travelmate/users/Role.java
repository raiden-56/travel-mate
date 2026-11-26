package com.travelmate.users;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;

import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "roles")
public class Role {

    @Id
    @Column(length = 40)
    private String name;

    @Column(nullable = false, length = 200)
    private String description;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "role_permissions", joinColumns = @JoinColumn(name = "role_name"))
    @Column(name = "permission_name")
    private Set<String> permissions = new HashSet<>();

    public String getName() { return name; }
    public String getDescription() { return description; }
    public Set<String> getPermissions() { return permissions; }
}
