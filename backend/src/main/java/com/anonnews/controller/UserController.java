package com.anonnews.controller;

import com.anonnews.dto.PreferencesUpdateRequest;
import com.anonnews.dto.UserDTO;
import com.anonnews.entity.User;
import com.anonnews.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/me")
    public ResponseEntity<UserDTO> getCurrentUser(HttpServletRequest request) {
        User user = getAuthenticatedUser(request);
        UserDTO userDTO = userService.getUser(user.getId());
        return ResponseEntity.ok(userDTO);
    }

    @PatchMapping("/me/preferences")
    public ResponseEntity<UserDTO> updatePreferences(
            @RequestBody PreferencesUpdateRequest preferencesUpdate,
            HttpServletRequest request) {

        User user = getAuthenticatedUser(request);
        UserDTO updatedUser = userService.updatePreferences(user.getId(), preferencesUpdate);
        return ResponseEntity.ok(updatedUser);
    }

    private User getAuthenticatedUser(HttpServletRequest request) {
        return (User) request.getAttribute("authenticatedUser");
    }
}
