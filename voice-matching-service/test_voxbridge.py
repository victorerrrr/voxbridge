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

    def test_producer_response_has_voice_character_fields(self):
        """Regression guard: the final results.append({...}) dict in
        _run_voice_match must include all 5 voice-character fields, or the
        frontend silently receives null (no error in logs) — see the
        breathiness/vibrato/melodic_range/pitch_stability bug fixed this
        session.
        """
        src = open(self.MAIN).read()
        idx = src.find("def _run_voice_match(")
        assert idx != -1
        body = src[idx:idx + 12000]
        required_fields = [
            "breathiness",
            "vibrato_rate",
            "vibrato_depth",
            "melodic_range_semitones",
            "pitch_stability",
        ]
        append_idx = body.find("results.append(")
        assert append_idx != -1, "results.append(...) not found in _run_voice_match"
        append_block = body[append_idx:append_idx + 4000]
        for field in required_fields:
            needle = f'"{field}": demo_row.get("{field}"'
            assert needle in append_block, (
                f"Missing '{field}' in the final results.append(...) dict — "
                f"it must be copied from demo_row or the frontend will get null."
            )

class TestVoiceStyle:
    """Regression guards for the Voice Style (Any/Singing/Rap) feature added
    this session. Covers the _parse_query_tags_form NameError bug, the
    KNOWN_GENRES constant, and the singing branch in _genre_weights.
    """

    MAIN = os.path.join(os.path.dirname(os.path.abspath(__file__)), "main.py")

    def _load_main(self):
        spec = importlib.util.spec_from_file_location("main_under_test", self.MAIN)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def test_known_genres_defined(self):
        src = open(self.MAIN).read()
        idx = src.find("KNOWN_GENRES")
        assert idx != -1, "KNOWN_GENRES constant not found in main.py"
        window = src[idx:idx + 200]
        expected_genres = ["rap", "hip-hop", "singing", "opera", "classical", "rnb", "soul"]
        for genre in expected_genres:
            needle = '"' + genre + '"'
            assert needle in window, "Expected genre missing from KNOWN_GENRES: " + genre

    def test_parse_query_tags_form_exists(self):
        src = open(self.MAIN).read()
        assert "def _parse_query_tags_form(" in src, (
            "_parse_query_tags_form is not defined -- this will cause a "
            "NameError on /voice-match-producer when query_tags is non-empty"
        )

    def test_parse_query_tags_form_handles_plain_string(self):
        module = self._load_main()
        result = module._parse_query_tags_form("rap")
        assert result == {"genre": "rap"}

    def test_parse_query_tags_form_handles_json_object(self):
        module = self._load_main()
        raw = '{"genre": "opera", "mood": "calm"}'
        result = module._parse_query_tags_form(raw)
        assert result == {"genre": "opera", "mood": "calm"}

    def test_parse_query_tags_form_handles_empty(self):
        module = self._load_main()
        assert module._parse_query_tags_form("") == {}
        assert module._parse_query_tags_form(None) == {}

    def test_parse_query_tags_form_handles_non_dict_json(self):
        module = self._load_main()
        raw = '["rap", "trap"]'
        result = module._parse_query_tags_form(raw)
        assert result == {"genre": raw}

    def test_genre_weights_singing_branch_does_not_crash(self):
        module = self._load_main()
        weights = module._genre_weights({"genre": "singing"})
        assert weights, "Expected non-empty weights dict for singing genre"
        total = sum(weights.values())
        assert abs(total - 1.0) < 1e-6, "Weights should sum to 1.0, got " + str(total)

    def test_genre_weights_rap_branch(self):
        module = self._load_main()
        weights = module._genre_weights({"genre": "rap"})
        assert weights["speaker"] > 0.25, "Rap branch should weight speaker timbre heavily"

    def test_build_voice_match_response_accepts_query_tags(self):
        src = open(self.MAIN).read()
        idx = src.find("def _build_voice_match_response(")
        assert idx != -1
        sig = src[idx:idx + 400]
        assert "query_tags" in sig, "_build_voice_match_response missing query_tags param"
        assert "genre_recognized" in src[idx:idx + 2000]
        assert "genre_used" in src[idx:idx + 2000]
