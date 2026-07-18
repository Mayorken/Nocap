// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title NoCap Challenge Escrow
/// @notice Refundable social commitments with creator-reviewed proof and pull payments.
contract NoCapChallenge {
    enum Status { Open, Settled, Cancelled }

    struct Challenge {
        address creator;
        string title;
        uint96 stake;
        uint64 startsAt;
        uint64 endsAt;
        uint16 maxParticipants;
        uint16 participantCount;
        uint16 approvedCount;
        Status status;
    }

    uint256 public challengeCount;
    mapping(uint256 => Challenge) private challenges;
    mapping(uint256 => address[]) private participants;
    mapping(uint256 => mapping(address => bool)) public hasJoined;
    mapping(uint256 => mapping(address => string)) public proofUri;
    mapping(uint256 => mapping(address => bool)) public proofApproved;
    mapping(uint256 => mapping(address => uint256)) public claimable;
    mapping(uint256 => mapping(address => bool)) public hasClaimed;

    event ChallengeCreated(uint256 indexed challengeId, address indexed creator, string title, uint256 stake);
    event ChallengeJoined(uint256 indexed challengeId, address indexed participant);
    event ProofSubmitted(uint256 indexed challengeId, address indexed participant, string proofUri);
    event ProofVerified(uint256 indexed challengeId, address indexed participant, bool approved);
    event ChallengeSettled(uint256 indexed challengeId, uint256 winners, uint256 payoutPerWinner);
    event PayoutClaimed(uint256 indexed challengeId, address indexed participant, uint256 amount);

    error ChallengeNotOpen();
    error ChallengeFull();
    error AlreadyJoined();
    error IncorrectStake();
    error InvalidSchedule();
    error InvalidCapacity();
    error NotParticipant();
    error NotCreator();
    error EmptyProof();
    error ProofMissing();
    error ChallengeNotEnded();
    error NothingToClaim();
    error TransferFailed();

    function createChallenge(
        string calldata title,
        uint64 startsAt,
        uint64 endsAt,
        uint16 maxParticipants
    ) external payable returns (uint256 challengeId) {
        if (msg.value == 0 || msg.value > type(uint96).max) revert IncorrectStake();
        if (startsAt < block.timestamp || endsAt <= startsAt || endsAt > block.timestamp + 30 days) revert InvalidSchedule();
        if (maxParticipants < 2 || maxParticipants > 100) revert InvalidCapacity();

        challengeId = ++challengeCount;
        challenges[challengeId] = Challenge({
            creator: msg.sender,
            title: title,
            stake: uint96(msg.value),
            startsAt: startsAt,
            endsAt: endsAt,
            maxParticipants: maxParticipants,
            participantCount: 1,
            approvedCount: 0,
            status: Status.Open
        });
        participants[challengeId].push(msg.sender);
        hasJoined[challengeId][msg.sender] = true;
        emit ChallengeCreated(challengeId, msg.sender, title, msg.value);
        emit ChallengeJoined(challengeId, msg.sender);
    }

    function joinChallenge(uint256 challengeId) external payable {
        Challenge storage challenge = challenges[challengeId];
        if (challenge.status != Status.Open || block.timestamp >= challenge.endsAt) revert ChallengeNotOpen();
        if (challenge.participantCount >= challenge.maxParticipants) revert ChallengeFull();
        if (hasJoined[challengeId][msg.sender]) revert AlreadyJoined();
        if (msg.value != challenge.stake) revert IncorrectStake();

        hasJoined[challengeId][msg.sender] = true;
        challenge.participantCount++;
        participants[challengeId].push(msg.sender);
        emit ChallengeJoined(challengeId, msg.sender);
    }

    function submitProof(uint256 challengeId, string calldata uri) external {
        Challenge storage challenge = challenges[challengeId];
        if (challenge.status != Status.Open || block.timestamp >= challenge.endsAt) revert ChallengeNotOpen();
        if (!hasJoined[challengeId][msg.sender]) revert NotParticipant();
        if (bytes(uri).length == 0) revert EmptyProof();
        proofUri[challengeId][msg.sender] = uri;
        emit ProofSubmitted(challengeId, msg.sender, uri);
    }

    function verifyProof(uint256 challengeId, address participant, bool approved) external {
        Challenge storage challenge = challenges[challengeId];
        if (msg.sender != challenge.creator) revert NotCreator();
        if (challenge.status != Status.Open) revert ChallengeNotOpen();
        if (!hasJoined[challengeId][participant]) revert NotParticipant();
        if (bytes(proofUri[challengeId][participant]).length == 0) revert ProofMissing();

        bool previous = proofApproved[challengeId][participant];
        if (previous != approved) {
            proofApproved[challengeId][participant] = approved;
            if (approved) challenge.approvedCount++;
            else challenge.approvedCount--;
        }
        emit ProofVerified(challengeId, participant, approved);
    }

    function settleChallenge(uint256 challengeId) external {
        Challenge storage challenge = challenges[challengeId];
        if (challenge.status != Status.Open) revert ChallengeNotOpen();
        if (block.timestamp < challenge.endsAt) revert ChallengeNotEnded();

        challenge.status = Status.Settled;
        uint256 winners = challenge.approvedCount;
        uint256 payout;
        address[] storage squad = participants[challengeId];

        if (winners == 0) {
            payout = challenge.stake;
            for (uint256 i; i < squad.length; ++i) claimable[challengeId][squad[i]] = payout;
        } else {
            payout = (uint256(challenge.stake) * challenge.participantCount) / winners;
            for (uint256 i; i < squad.length; ++i) {
                if (proofApproved[challengeId][squad[i]]) claimable[challengeId][squad[i]] = payout;
            }
        }
        emit ChallengeSettled(challengeId, winners, payout);
    }

    function claim(uint256 challengeId) external {
        uint256 amount = claimable[challengeId][msg.sender];
        if (amount == 0 || hasClaimed[challengeId][msg.sender]) revert NothingToClaim();
        hasClaimed[challengeId][msg.sender] = true;
        claimable[challengeId][msg.sender] = 0;
        (bool success,) = payable(msg.sender).call{value: amount}("");
        if (!success) revert TransferFailed();
        emit PayoutClaimed(challengeId, msg.sender, amount);
    }

    function getChallenge(uint256 challengeId) external view returns (Challenge memory) {
        return challenges[challengeId];
    }

    function getParticipants(uint256 challengeId) external view returns (address[] memory) {
        return participants[challengeId];
    }
}
