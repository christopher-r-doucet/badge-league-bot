from ..constants import K_FACTOR, RANKS, RANK_EMOJIS

def calculate_elo_change(winner_elo: float, loser_elo: float) -> tuple[float, float]:
    """Calculate ELO changes after a match."""
    expected_winner = 1 / (1 + 10 ** ((loser_elo - winner_elo) / 400))
    expected_loser = 1 - expected_winner
    
    winner_change = K_FACTOR * (1 - expected_winner)
    loser_change = K_FACTOR * (0 - expected_loser)
    
    return winner_change, loser_change

def get_rank(elo: float) -> tuple[str, str]:
    """Get rank name and emoji based on ELO."""
    for rank, (min_elo, max_elo) in RANKS.items():
        if min_elo <= elo <= max_elo:
            return rank, RANK_EMOJIS[rank]
    return "Unranked", ""
