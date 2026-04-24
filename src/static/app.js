document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const authStatus = document.getElementById("auth-status");
  const teacherRequiredNote = document.getElementById("teacher-required-note");
  const userMenuBtn = document.getElementById("user-menu-btn");
  const userMenu = document.getElementById("user-menu");
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const cancelLoginBtn = document.getElementById("cancel-login");

  let authToken = localStorage.getItem("teacherAuthToken") || "";
  let teacherUsername = localStorage.getItem("teacherUsername") || "";

  function showMessage(type, text) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function updateAuthUI() {
    const isTeacher = Boolean(authToken);
    signupForm.querySelectorAll("input, select, button").forEach((field) => {
      field.disabled = !isTeacher;
    });

    if (isTeacher) {
      authStatus.textContent = `Teacher mode: ${teacherUsername}`;
      teacherRequiredNote.classList.add("hidden");
      loginBtn.classList.add("hidden");
      logoutBtn.classList.remove("hidden");
    } else {
      authStatus.textContent = "Viewing as student";
      teacherRequiredNote.classList.remove("hidden");
      loginBtn.classList.remove("hidden");
      logoutBtn.classList.add("hidden");
    }
  }

  async function fetchWithTeacherAuth(url, options = {}) {
    const headers = {
      ...(options.headers || {}),
    };

    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    return fetch(url, {
      ...options,
      headers,
    });
  }

  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;

        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map((email) => {
                    const deleteButton = authToken
                      ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                      : "";
                    return `<li><span class="participant-email">${email}</span>${deleteButton}</li>`;
                  })
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML = "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetchWithTeacherAuth(
        `/activities/${encodeURIComponent(activity)}/unregister?email=${encodeURIComponent(email)}`,
        { method: "DELETE" }
      );

      const result = await response.json();
      if (response.ok) {
        showMessage("success", result.message);
        fetchActivities();
      } else {
        showMessage("error", result.detail || "An error occurred");
      }
    } catch (error) {
      showMessage("error", "Failed to unregister. Please try again.");
      console.error("Error unregistering:", error);
    }
  }

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetchWithTeacherAuth(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        { method: "POST" }
      );

      const result = await response.json();
      if (response.ok) {
        showMessage("success", result.message);
        signupForm.reset();
        fetchActivities();
      } else {
        showMessage("error", result.detail || "An error occurred");
      }
    } catch (error) {
      showMessage("error", "Failed to sign up. Please try again.");
      console.error("Error signing up:", error);
    }
  });

  userMenuBtn.addEventListener("click", () => {
    userMenu.classList.toggle("hidden");
  });

  loginBtn.addEventListener("click", () => {
    userMenu.classList.add("hidden");
    loginModal.classList.remove("hidden");
  });

  cancelLoginBtn.addEventListener("click", () => {
    loginModal.classList.add("hidden");
    loginForm.reset();
  });

  logoutBtn.addEventListener("click", async () => {
    try {
      await fetchWithTeacherAuth("/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Error logging out:", error);
    }

    authToken = "";
    teacherUsername = "";
    localStorage.removeItem("teacherAuthToken");
    localStorage.removeItem("teacherUsername");
    updateAuthUI();
    fetchActivities();
    showMessage("info", "You have been logged out.");
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();
      if (!response.ok) {
        showMessage("error", result.detail || "Login failed.");
        return;
      }

      authToken = result.token;
      teacherUsername = result.username;
      localStorage.setItem("teacherAuthToken", authToken);
      localStorage.setItem("teacherUsername", teacherUsername);

      loginModal.classList.add("hidden");
      loginForm.reset();
      updateAuthUI();
      fetchActivities();
      showMessage("success", `Welcome, ${teacherUsername}.`);
    } catch (error) {
      showMessage("error", "Unable to log in right now.");
      console.error("Error logging in:", error);
    }
  });

  document.addEventListener("click", (event) => {
    if (!userMenu.contains(event.target) && event.target !== userMenuBtn) {
      userMenu.classList.add("hidden");
    }
  });

  updateAuthUI();
  fetchActivities();
});
