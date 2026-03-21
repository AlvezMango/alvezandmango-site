const SUPABASE_URL = "https://jbwlwbawssjimugtayts.supabase.co";
const SUPABASE_KEY = "sb_publishable_fMXuCisXnwyFqYhBuQrrFg_38HgpDgK";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function saveDraft() {
  const { data, error } = await supabase
    .from('drafts')
    .insert([
      {
        draft_name: "Test Draft",
        status: "draft",
        photographer_name: "Test Photographer",
        photographer_instagram: "@test",
      }
    ]);

  if (error) {
    console.error("Error saving draft:", error);
    alert("Error saving draft");
  } else {
    console.log("Saved:", data);
    alert("Draft saved successfully!");
  }
}
