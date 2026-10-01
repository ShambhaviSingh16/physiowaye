const profileForm = document.getElementById("profileForm");
const profileStatus = document.getElementById("profileStatus");
const profileName = document.getElementById("profileName");
const profileEmail = document.getElementById("profileEmail");
const profilePhone = document.getElementById("profilePhone");

async function loadProfile() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return;
  }

  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("full_name, email, phone")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error || !profile) {
    console.error("Unable to load profile:", error);
    profileStatus.textContent = "We couldn’t load your profile. Please refresh and try again.";
    return;
  }

  profileName.value = profile.full_name || session.user.user_metadata?.full_name || "";
  profileEmail.value = profile.email || session.user.email || "";
  profilePhone.value = profile.phone || "";
  profileStatus.textContent = "Your profile is up to date.";
  profileForm.hidden = false;
}

profileForm.addEventListener("submit", async event => {
  event.preventDefault();
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return;
  }

  const fullName = profileName.value.trim();
  if (!fullName) {
    profileStatus.textContent = "Please enter your name.";
    profileName.focus();
    return;
  }

  const saveButton = profileForm.querySelector("button[type='submit']");
  saveButton.disabled = true;
  profileStatus.textContent = "Saving your changes…";

  const { error } = await supabaseClient
    .from("profiles")
    .update({ full_name: fullName, phone: profilePhone.value.trim() || null })
    .eq("id", session.user.id);

  saveButton.disabled = false;
  profileStatus.textContent = error
    ? "We couldn’t save your changes. Please try again."
    : "Your changes have been saved.";

  if (error) console.error("Unable to update profile:", error);
});

loadProfile();
