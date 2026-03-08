"""Policy recommendation engine — maps pollution source + AQI to admin actions."""

POLICY_DATABASE = {
    "construction": {
        "icon": "🏗️",
        "label": "Construction Dust",
        "admin_actions": [
            {"priority": "high", "action": "Issue stop-work order for construction sites in ward", "authority": "Municipal Commissioner"},
            {"priority": "high", "action": "Deploy water-sprinkler tankers at active sites", "authority": "Ward Officer"},
            {"priority": "medium", "action": "Mandate dust-suppression nets on all buildings under construction", "authority": "Building Dept"},
            {"priority": "medium", "action": "Fine violators under Environment Protection Act Section 5", "authority": "Pollution Board"},
            {"priority": "low", "action": "Schedule road-sweeping machines in affected ward", "authority": "Sanitation Dept"},
        ],
        "citizen_advice": [
            "Wear N95 mask when outdoors near construction zones",
            "Keep windows closed between 10am-5pm",
            "Avoid jogging or walking near construction areas",
            "Use wet cloth on window gaps to block fine dust",
        ],
    },
    "vehicle": {
        "icon": "🚗",
        "label": "Vehicle Exhaust",
        "admin_actions": [
            {"priority": "high", "action": "Implement odd-even vehicle policy for the ward", "authority": "Traffic Police"},
            {"priority": "high", "action": "Set up mobile pollution-checking camps at ward entry points", "authority": "Transport Dept"},
            {"priority": "medium", "action": "Increase public transport frequency on affected routes", "authority": "City Transport"},
            {"priority": "medium", "action": "Restrict heavy diesel vehicles during 8am-10pm", "authority": "Traffic Police"},
            {"priority": "low", "action": "Promote EV adoption with subsidized charging stations", "authority": "Smart City Office"},
        ],
        "citizen_advice": [
            "Use public transport or carpooling",
            "Avoid outdoor exercise during rush hours (8-10am, 5-8pm)",
            "Choose routes away from main roads for walking",
            "Consider work-from-home if AQI > 200",
        ],
    },
    "biomass": {
        "icon": "🔥",
        "label": "Biomass Burning",
        "admin_actions": [
            {"priority": "high", "action": "Issue biomass/crop burning ban order for the ward", "authority": "District Magistrate"},
            {"priority": "high", "action": "Deploy patrol teams to detect and stop burning sources", "authority": "Fire Department"},
            {"priority": "medium", "action": "Provide free waste-collection to remove burning incentive", "authority": "Sanitation Dept"},
            {"priority": "medium", "action": "Set up composting centres as alternatives", "authority": "Green Office"},
            {"priority": "low", "action": "Awareness campaign on health effects of open burning", "authority": "Health Dept"},
        ],
        "citizen_advice": [
            "Avoid outdoor activities after 6pm when burning peaks",
            "Vulnerable groups (elderly, children, asthma patients) must stay indoors",
            "Use air purifier if available",
            "Report open burning to municipal helpline",
        ],
    },
    "industrial": {
        "icon": "🏭",
        "label": "Industrial Emission",
        "admin_actions": [
            {"priority": "high", "action": "Conduct surprise emission audit of nearby factories", "authority": "Pollution Board"},
            {"priority": "high", "action": "Verify pollution-control equipment compliance", "authority": "Industrial Safety"},
            {"priority": "medium", "action": "Issue show-cause notices to non-compliant units", "authority": "Pollution Board"},
            {"priority": "low", "action": "Mandate real-time emission monitoring systems", "authority": "Environment Ministry"},
        ],
        "citizen_advice": [
            "Stay indoors with air purifier running",
            "Wear N95 mask for all outdoor exposure",
            "Report unusual smoke or odour to pollution board",
        ],
    },
    "unknown": {
        "icon": "❓",
        "label": "Unidentified Source",
        "admin_actions": [
            {"priority": "medium", "action": "Deploy field investigation team to identify source", "authority": "Environment Cell"},
            {"priority": "medium", "action": "Review satellite imagery for the ward", "authority": "GIS Department"},
            {"priority": "low", "action": "Install additional monitoring devices in the ward", "authority": "Smart City Office"},
        ],
        "citizen_advice": [
            "Follow general AQI-based precautions",
            "Report any visible pollution sources to helpline",
        ],
    },
}


def get_policy_recommendations(source: str, aqi: int) -> dict:
    """Generate policy recommendations based on detected source and AQI."""
    source_key = source if source in POLICY_DATABASE else "unknown"
    policy = POLICY_DATABASE[source_key]

    # Filter actions by AQI severity
    if aqi <= 100:
        actions = [a for a in policy["admin_actions"] if a["priority"] == "low"]
    elif aqi <= 200:
        actions = [a for a in policy["admin_actions"] if a["priority"] in ("low", "medium")]
    else:
        actions = policy["admin_actions"]  # All actions for AQI > 200

    return {
        "source": source_key,
        "icon": policy["icon"],
        "label": policy["label"],
        "aqi": aqi,
        "severity": "critical" if aqi > 300 else "high" if aqi > 200 else "moderate" if aqi > 100 else "low",
        "admin_actions": actions,
        "citizen_advice": policy["citizen_advice"],
    }
