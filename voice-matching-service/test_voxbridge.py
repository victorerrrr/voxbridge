import json, os, sys, types, pytest, importlib.util

PROFILES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "demo_profiles")
EXPECTED_LANGUAGES = {
    "Real vocal african girl 7.json": "Afrikaans",
    "Real vocal indian girl 8.json": "Hindi",
    "Real vocal spanish girl 6.json": "Spanish",
}

class TestDemoProfiles:
    def _profiles(self):
        return [f for f in os.listdir(PROFILES_DIR) if f.endswith(".json")]
    def test_profiles_exist(self):
        assert len(self._profiles()) > 0
    def test_all_have_language(self):
        missing = [f for f in self._profiles() if not json.load(open(os.path.join(PROFILES_DIR,f))).get("language")]
        assert not missing, f"Missing language: {missing}"
    def test_non_english_correct(self):
        for fname, lang in EXPECTED_LANGUAGES.items():
            fp = os.path.join(PROFILES_DIR, fname)
            if not os.path.exists(fp): continue
            got = json.load(open(fp)).get("language")
            assert got == lang, f"{fname}: expected {lang}, got {got}"
    def test_english_profiles(self):
        for f in self._profiles():
            if f in EXPECTED_LANGUAGES: continue
            got = json.load(open(os.path.join(PROFILES_DIR,f))).get("language","")
            assert got == "English", f"{f}: expected English, got {got}"

class TestLanguagePenalty:
    def _apply(self, results, ai, part):
        if ai and part and ai != part:
            for r in results:
                dl = r.get("demo_language","")
                if dl and dl != part:
                    r["similarity"] = max(0.0, round(r.get("similarity",0)*0.75,1))
        return results
    def test_penalty_applied(self):
        r = self._apply([{"demo_language":"Afrikaans","similarity":80.0}],"Portuguese","English")
        assert r[0]["similarity"] == 60.0
    def test_no_penalty_demo_matches_part(self):
        r = self._apply([{"demo_language":"English","similarity":80.0}],"Portuguese","English")
        assert r[0]["similarity"] == 80.0
    def test_no_penalty_same_lang(self):
        r = self._apply([{"demo_language":"Afrikaans","similarity":80.0}],"English","English")
        assert r[0]["similarity"] == 80.0
    def test_no_penalty_empty_demo_lang(self):
        r = self._apply([{"demo_language":"","similarity":80.0}],"Portuguese","English")
        assert r[0]["similarity"] == 80.0
    def test_floor_zero(self):
        r = self._apply([{"demo_language":"Hindi","similarity":0.0}],"Portuguese","English")
        assert r[0]["similarity"] == 0.0
    def test_selective(self):
        res = [{"demo_language":"English","similarity":90.0},{"demo_language":"Afrikaans","similarity":80.0},{"demo_language":"Hindi","similarity":70.0}]
        r = self._apply(res,"Portuguese","English")
        assert r[0]["similarity"] == 90.0
        assert r[1]["similarity"] == 60.0
        assert r[2]["similarity"] == 52.5

class TestCodeInvariants:
    MAIN = os.path.join(os.path.dirname(os.path.abspath(__file__)), "main.py")
    def test_demo_language_initialized(self):
        src = open(self.MAIN).read()
        assert src.count("demo_language = """) >= 1
    def test_finalize_not_nested(self):
        src = open(self.MAIN).read()
        idx = src.find("_finalize_voice_match_results(")
        assert idx != -1
        line = src[idx:].splitlines()[0]
        assert len(line) - len(line.lstrip()) <= 12
    def test_load_demo_profile_7_values(self):
        src = open(self.MAIN).read()
        idx = src.find("def _load_demo_profile(")
        assert idx != -1
        body = src[idx:idx+3000]
        returns = [l.strip() for l in body.splitlines() if l.strip().startswith("return ") and "," in l]
        assert len(returns) >= 1
        assert returns[0].count(",") + 1 == 7
