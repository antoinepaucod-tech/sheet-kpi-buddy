"""
Iteration 50 Tests: DUO warning, Churn calculation, Auto-generate reviews
Features:
1. POST /api/annual-reviews/auto-generate - should return created, skipped, total_eligible
2. GET /api/monthly-kpis - enriched with real churn from member exit_dates
3. DUO members should have is_duo=True and proper duo_primary flag
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAutoGenerateReviews:
    """Test auto-generate reviews endpoint"""

    def test_auto_generate_returns_correct_structure(self):
        """POST /api/annual-reviews/auto-generate should return created, skipped, total_eligible"""
        response = requests.post(f"{BASE_URL}/api/annual-reviews/auto-generate")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "created" in data, "Response should have 'created' field"
        assert "skipped" in data, "Response should have 'skipped' field"
        assert "total_eligible" in data, "Response should have 'total_eligible' field"
        assert "message" in data, "Response should have 'message' field"
        
        # Values should be integers
        assert isinstance(data["created"], int)
        assert isinstance(data["skipped"], int)
        assert isinstance(data["total_eligible"], int)
        
        print(f"Auto-generate result: created={data['created']}, skipped={data['skipped']}, eligible={data['total_eligible']}")


class TestChurnCalculation:
    """Test churn rate calculation from member exit_dates"""

    def test_monthly_kpis_have_churn_data(self):
        """GET /api/monthly-kpis should return churn_rate for months with departures"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) > 0, "Should have at least one month of data"
        
        # Check structure of each KPI record
        for kpi in data[:3]:  # Check first 3 months
            assert "month" in kpi, "Each KPI should have 'month'"
            assert "churn_rate" in kpi, "Each KPI should have 'churn_rate'"
            assert "lost_members" in kpi, "Each KPI should have 'lost_members'"

    def test_march_2026_has_churn(self):
        """March 2026 should have lost_members > 0 and churn_rate > 0 based on exit_dates"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis")
        assert response.status_code == 200
        
        data = response.json()
        march_2026 = next((k for k in data if k["month"] == "2026-03"), None)
        
        assert march_2026 is not None, "Should have data for March 2026"
        assert march_2026["lost_members"] > 0, f"March 2026 should have lost_members > 0, got {march_2026['lost_members']}"
        assert march_2026["churn_rate"] > 0, f"March 2026 should have churn_rate > 0, got {march_2026['churn_rate']}"
        
        # Expected ~4.4% churn based on 5 departures from ~113 members
        print(f"March 2026 churn: lost_members={march_2026['lost_members']}, churn_rate={march_2026['churn_rate']}%")

    def test_churn_calculation_formula(self):
        """Verify churn rate is calculated correctly: lost_members / total_members * 100"""
        response = requests.get(f"{BASE_URL}/api/monthly-kpis")
        assert response.status_code == 200
        
        data = response.json()
        march_2026 = next((k for k in data if k["month"] == "2026-03"), None)
        
        if march_2026 and march_2026["total_members"] > 0 and march_2026["lost_members"] > 0:
            expected_churn = (march_2026["lost_members"] / march_2026["total_members"]) * 100
            actual_churn = march_2026["churn_rate"]
            # Allow small tolerance for rounding
            assert abs(actual_churn - expected_churn) < 1, f"Churn should be ~{expected_churn:.2f}%, got {actual_churn}%"


class TestDuoMembers:
    """Test DUO member functionality"""

    def test_duo_members_exist(self):
        """Verify DUO members exist in the system"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        
        members = response.json()
        duo_members = [m for m in members if m.get("is_duo") is True]
        
        assert len(duo_members) > 0, "Should have at least one DUO member"
        print(f"Found {len(duo_members)} DUO members")

    def test_duo_members_have_correct_flags(self):
        """DUO members should have is_duo=True and duo_primary flag"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        
        members = response.json()
        duo_members = [m for m in members if m.get("is_duo") is True]
        
        # Check that we have both primary and partner members
        primaries = [m for m in duo_members if m.get("duo_primary") is True]
        partners = [m for m in duo_members if m.get("duo_primary") is False]
        
        assert len(primaries) > 0, "Should have at least one DUO primary member"
        assert len(partners) > 0, "Should have at least one DUO partner member"
        
        print(f"DUO members: {len(primaries)} primaries, {len(partners)} partners")

    def test_duo_member_has_subscription_group(self):
        """DUO members should have subscription_group_id linking pairs"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        
        members = response.json()
        duo_members = [m for m in members if m.get("is_duo") is True]
        
        # At least some DUO members should have subscription_group_id
        with_group_id = [m for m in duo_members if m.get("subscription_group_id")]
        assert len(with_group_id) > 0, "Some DUO members should have subscription_group_id"


class TestAnnualReviewsEndpoints:
    """Test annual reviews related endpoints"""

    def test_get_all_reviews(self):
        """GET /api/annual-reviews should work"""
        response = requests.get(f"{BASE_URL}/api/annual-reviews")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"

    def test_get_upcoming_reviews(self):
        """GET /api/annual-reviews/upcoming should work"""
        response = requests.get(f"{BASE_URL}/api/annual-reviews/upcoming?days=60")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"


class TestMemberStatsEndpoint:
    """Test member stats for dashboard"""

    def test_member_stats_endpoint(self):
        """GET /api/members/stats should return active/departed counts"""
        response = requests.get(f"{BASE_URL}/api/members/stats")
        assert response.status_code == 200
        
        data = response.json()
        assert "active_members" in data, "Should have active_members count"
        assert "departed" in data, "Should have departed count"
        
        print(f"Member stats: active={data.get('active_members')}, departed={data.get('departed')}")


class TestMemberExitDates:
    """Test member exit_date functionality for churn calculation"""

    def test_members_with_exit_dates_exist(self):
        """Verify there are members with exit_date set"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        
        members = response.json()
        with_exit = [m for m in members if m.get("exit_date")]
        
        assert len(with_exit) > 0, "Should have members with exit_date"
        print(f"Members with exit_date: {len(with_exit)}")

    def test_march_2026_exits(self):
        """Verify there are members with exit_date in March 2026"""
        response = requests.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        
        members = response.json()
        march_exits = [m for m in members if m.get("exit_date") and m["exit_date"].startswith("2026-03")]
        
        assert len(march_exits) > 0, "Should have members with exit_date in March 2026"
        print(f"Members with exit in March 2026: {len(march_exits)}")
        for m in march_exits[:3]:
            print(f"  - {m['name']}: exit_date={m['exit_date']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
