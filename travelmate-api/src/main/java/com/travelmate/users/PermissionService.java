package com.travelmate.users;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.Set;
import java.util.TreeSet;

@Service
public class PermissionService {

    private final RoleRepository roles;

    public PermissionService(RoleRepository roles) {
        this.roles = roles;
    }

    @Transactional(readOnly = true)
    public Set<String> permissionsFor(Collection<String> roleNames) {
        Set<String> out = new TreeSet<>();
        roles.findAllById(roleNames).forEach(r -> out.addAll(r.getPermissions()));
        return out;
    }
}
