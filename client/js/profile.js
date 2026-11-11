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

  let profile, error;
  try {
    ({ data: profile, error } = await supabaseClient
      .from("profiles")
      .select("full_name, email, phone")
      .eq("id", session.user.id)
      .maybeSingle());
  } catch (requestError) { error = requestError; }

  if (error || !profile) {
    console.error("Unable to load profile:", error);
    profileStatus.dataset.state = 'error';
    profileStatus.setAttribute('role', 'alert');
    profileStatus.setAttribute('aria-live', 'assertive');
    profileStatus.textContent = "We couldn’t load your profile. Please refresh and try again.";
    showToast('Refresh the page and try again.', { type: 'error', title: 'Profile unavailable', announce: false });
    return;
  }

  profileName.value = profile.full_name || session.user.user_metadata?.full_name || "";
  profileEmail.value = profile.email || session.user.email || "";
  profilePhone.value = profile.phone || "";
  profileStatus.dataset.state = 'idle';
  profileStatus.setAttribute('role', 'status');
  profileStatus.setAttribute('aria-live', 'polite');
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
    profileStatus.dataset.state = 'error';
    profileStatus.setAttribute('role', 'alert');
    profileStatus.setAttribute('aria-live', 'assertive');
    profileStatus.textContent = "Please enter your name.";
    profileName.focus();
    return;
  }

  const saveButton = profileForm.querySelector("button[type='submit']");
  saveButton.disabled = true;
  profileStatus.dataset.state = 'sending';
  profileStatus.setAttribute('role', 'status');
  profileStatus.setAttribute('aria-live', 'polite');
  profileStatus.textContent = "Saving your changes…";

  let error;
  try {
    ({ error } = await supabaseClient
      .from("profiles")
      .update({ full_name: fullName, phone: profilePhone.value.trim() || null })
      .eq("id", session.user.id));
  } catch (requestError) { error = requestError; }

  saveButton.disabled = false;
  profileStatus.textContent = error
    ? "We couldn’t save your changes. Please try again."
    : "Your changes have been saved.";

  profileStatus.dataset.state = error ? 'error' : 'success';
  profileStatus.setAttribute('role', error ? 'alert' : 'status');
  profileStatus.setAttribute('aria-live', error ? 'assertive' : 'polite');
  showToast(error ? 'Please try saving your changes again.' : 'Your account details are up to date.', {
    type: error ? 'error' : 'success',
    title: error ? 'Changes not saved' : 'Profile saved',
    announce: false
  });

  if (error) console.error("Unable to update profile:", error);
});

loadProfile();
