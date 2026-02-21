package com.o11ynews.controller;

import com.o11ynews.dto.PreferencesUpdateRequest;
import com.o11ynews.dto.UserDTO;
import com.o11ynews.entity.User;
import com.o11ynews.service.UserService;
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
